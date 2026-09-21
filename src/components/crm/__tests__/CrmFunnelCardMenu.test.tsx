
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { NextIntlClientProvider } from "next-intl";
import ptMessages from "@/i18n/messages/pt.json";

import type { InboxEntry, Label, Stage } from "@/lib/conversations/types";
import type { FunnelStages } from "@/app/actions/stages";

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true }),
}));
vi.mock("@/app/actions/stages", () => ({
  reorderStagesAction: vi.fn(),
}));

import CrmFunnelView from "../CrmFunnelView";

const STAGES: Stage[] = [
  { id: "stage-a", name: "Novo", color: "#2563eb", position: 0 },
] as unknown as Stage[];

const FUNNELS: FunnelStages[] = [
  {
    pipelineId: "f1",
    pipelineName: "Funil padrão",
    isDefault: true,
    position: 0,
    stages: STAGES,
  },
  {
    pipelineId: "f2",
    pipelineName: "Outro funil",
    isDefault: false,
    position: 1,
    stages: [
      { id: "s9", name: "Entrada", color: "#0ea5e9", position: 0 },
    ] as unknown as Stage[],
  },
];

const LABELS: Label[] = [
  {
    id: "label-1",
    userId: "u1",
    name: "Prioridade",
    color: "#f43f5e",
    position: 0,
    createdAt: "",
    updatedAt: "",
  },
];

function entry(n: number): InboxEntry {
  return {
    entry_id: `e${n}`,
    entry_type: "whatsapp",
    lead_name: `Lead ${n}`,
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
    stage: { stage_id: "stage-a", name: "Novo", color: "#2563eb" },
    labels: [],
  } as unknown as InboxEntry;
}

function renderBoard(overrides: Partial<React.ComponentProps<typeof CrmFunnelView>> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmFunnelView
      entries={[entry(1), entry(2), entry(3)]}
      stages={STAGES}
      selectedEntryId={null}
      onSelect={() => {}}
      onStagesReorder={() => {}}
      labels={LABELS}
      onAssignLabel={() => {}}
      onRemoveLabel={() => {}}
        funnelStages={FUNNELS}
        onMoveToFunnel={async () => null}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

function openFirstCardMenu() {
  const triggers = screen.getAllByRole("button", { name: "Ações da conversa" });
  fireEvent.click(triggers[0]);
  return screen.getByRole("menu");
}

describe("kanban card menu", () => {
  it("opens outside the column that used to clip it", () => {
    const { container } = renderBoard();

    const menu = openFirstCardMenu();

    const column = container.querySelector("[data-column-id]");
    expect(column).not.toBeNull();
    expect(column!.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
    expect(menu).toHaveStyle({ position: "fixed" });
  });

  it("keeps the funnel move reachable, not buried under the cards below", () => {
    renderBoard();

    const menu = openFirstCardMenu();

    const move = screen.getByRole("menuitem", {
      name: /Mover para outro funil/,
    });
    expect(menu.contains(move)).toBe(true);
  });

  it("opens the funnel dialog when the move is clicked", () => {
    renderBoard();

    openFirstCardMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Mover para outro funil/ }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog").textContent).toContain(
      "Mover para outro funil",
    );
  });

  it("still offers the funnel move on a workspace with no labels", () => {
    renderBoard({ labels: [] });

    const menu = openFirstCardMenu();

    expect(menu.textContent).toContain("Mover para outro funil");
    expect(menu.textContent).not.toContain("Etiquetas");
  });

  it("closes on Escape without selecting the card underneath", () => {
    const onSelect = vi.fn();
    renderBoard({ onSelect });

    openFirstCardMenu();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
