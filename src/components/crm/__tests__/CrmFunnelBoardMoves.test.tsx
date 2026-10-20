import { render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { InboxEntry, Stage } from "@/lib/conversations/types";
import { fakeBoardLayout, flushTimers, keyboardMove, pressKey } from "@/test/board-layout";

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
);
const reorderStagesAction = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true }),
}));
vi.mock("@/app/actions/stages", () => ({ reorderStagesAction }));

import CrmFunnelView from "../CrmFunnelView";

const STAGES: Stage[] = [
  { id: "stage-a", name: "Novo", color: "#2563eb", position: 0 },
  { id: "stage-b", name: "Proposta", color: "#16a34a", position: 1 },
] as unknown as Stage[];

const LAYOUT = ["stage-a", "stage-b", "__unstaged__"];

function entry(id: string, stageId: string | null): InboxEntry {
  return {
    entry_id: id,
    entry_type: "whatsapp",
    lead_name: `Lead ${id}`,
    lead_number: "+5511999999999",
    unread_count: 0,
    last_message_preview: "oi",
    last_message_at: new Date().toISOString(),
    last_message_type: "text",
    last_message_sender: "lead",
    last_message_sender_avatar: "",
    window_open: true,
    window_expires_at: null,
    business_phone_id: "bp1",
    stage: stageId ? { stage_id: stageId, name: stageId, color: "#000" } : null,
    labels: [],
  } as unknown as InboxEntry;
}

function renderFunnel(props: Partial<React.ComponentProps<typeof CrmFunnelView>> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmFunnelView
        entries={[entry("e1", "stage-a")]}
        stages={STAGES}
        selectedEntryId={null}
        onSelect={() => {}}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

function card(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function column(id: string): HTMLElement {
  return document.querySelector(`[data-column-id='${id}']`) as HTMLElement;
}

function undoToast() {
  const [message, options] = toastMock.mock.calls[0] as [
    string,
    { action: { label: string; onClick: () => void } },
  ];
  return { message, options };
}

describe("funnel card moves", () => {
  beforeEach(() => {
    window.localStorage.clear();
    toastMock.mockClear();
    reorderStagesAction.mockReset();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(fakeBoardLayout(LAYOUT));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("puts the card back where it was when the server refuses the move", async () => {
    const onEntryStageChange = vi.fn().mockResolvedValue(false);
    renderFunnel({ onEntryStageChange });

    await keyboardMove(card("Lead e1"), "ArrowRight");
    await flushTimers();

    expect(onEntryStageChange).toHaveBeenCalledWith("e1", "whatsapp", "stage-b", "stage-a");
    expect(within(column("stage-a")).getByText("Lead e1")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(column("stage-b")).queryByText("Lead e1")).not.toBeInTheDocument(),
    );
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("offers undo after an accepted move, and undo moves the card back as a new command", async () => {
    const onEntryStageChange = vi.fn().mockResolvedValue(true);
    renderFunnel({ onEntryStageChange });

    await keyboardMove(card("Lead e1"), "ArrowRight");
    await flushTimers();

    expect(within(column("stage-b")).getByText("Lead e1")).toBeInTheDocument();
    const { message, options } = undoToast();
    expect(message).toBe("Movido para Proposta");
    expect(options.action.label).toBe("Desfazer");

    options.action.onClick();
    await flushTimers();

    expect(onEntryStageChange).toHaveBeenLastCalledWith("e1", "whatsapp", "stage-a", "stage-b");
    expect(within(column("stage-a")).getByText("Lead e1")).toBeInTheDocument();
  });

  it("offers no undo for a card taken out of the untagged column, which the server cannot move back into", async () => {
    const onEntryStageChange = vi.fn().mockResolvedValue(true);
    renderFunnel({ entries: [entry("e2", null)], onEntryStageChange });

    await keyboardMove(card("Lead e2"), "ArrowLeft");
    await flushTimers();

    expect(onEntryStageChange).toHaveBeenCalledWith("e2", "whatsapp", "stage-b", "__unstaged__");
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("reorders columns from the keyboard through the drag handle", async () => {
    reorderStagesAction.mockResolvedValue({ stages: [], error: null });
    renderFunnel({ onStagesReorder: vi.fn() });

    const handle = within(column("stage-a")).getByRole("button", { name: "Arrastar coluna" });
    await keyboardMove(handle, "ArrowRight");
    await flushTimers();

    expect(reorderStagesAction).toHaveBeenCalledWith(["stage-b", "stage-a"]);
  });

  it("rolls the column order back when saving it fails", async () => {
    reorderStagesAction.mockResolvedValue({ stages: [], error: "falhou" });
    renderFunnel({ onStagesReorder: vi.fn() });

    const handle = within(column("stage-a")).getByRole("button", { name: "Arrastar coluna" });
    await keyboardMove(handle, "ArrowRight");
    await flushTimers();

    expect(toastMock.error).toHaveBeenCalledWith("falhou");
    const order = [...document.querySelectorAll("[data-column-id]")].map((el) =>
      el.getAttribute("data-column-id"),
    );
    expect(order).toEqual(["stage-a", "stage-b"]);
  });

  it("shows no column handle to someone who cannot reorder stages", () => {
    renderFunnel({ onStagesReorder: undefined });

    expect(screen.queryByRole("button", { name: "Arrastar coluna" })).not.toBeInTheDocument();
  });

  it("keeps Esc on a lifted column from saving anything", async () => {
    renderFunnel({ onStagesReorder: vi.fn() });
    const handle = within(column("stage-a")).getByRole("button", { name: "Arrastar coluna" });
    handle.focus();

    await pressKey(handle, "Space", " ");
    await pressKey(handle, "ArrowRight");
    await pressKey(handle, "Escape");

    expect(reorderStagesAction).not.toHaveBeenCalled();
  });
});
