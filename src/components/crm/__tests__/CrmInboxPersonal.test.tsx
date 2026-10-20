import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { PersonalInboxControls } from "@/hooks/use-personal-marks";
import { NO_PERSONAL_MARKS, withMark, type PersonalMarks } from "@/lib/conversations/personal-marks";
import type { InboxEntry, Label, WsSearchInboxPayload } from "@/lib/conversations/types";

const sonner = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() });
  return { toast };
});
const bulk = vi.hoisted(() => ({ crmBulkAction: vi.fn() }));
const crm = vi.hoisted(() => ({ typingByEntry: new Map(), viewersByEntry: new Map() }));

vi.mock("sonner", () => sonner);
vi.mock("@/contexts/crm-context", () => ({ useOptionalCrm: () => crm }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => false, currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "u-ana" }));
vi.mock("@/app/actions/workspace", () => ({ listAssignableMembersAction: vi.fn().mockResolvedValue({ members: [] }) }));
vi.mock("@/app/actions/crm-board", () => bulk);
vi.mock("@/hooks/use-outcome-capture", () => ({
  useOutcomeCapture: () => ({ capture: null, loaded: true }),
  outcomeIsRequired: () => false,
}));
vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/dashboard/NoDepartmentNotice", () => ({
  useBlockedByMissingDepartment: () => false,
  NoDepartmentNotice: () => null,
}));
vi.mock("@/components/crm/InboxEntryContextMenu", () => ({
  InboxEntryContextMenu: ({ children, entry, actions }: { children: ReactNode; entry: InboxEntry; actions: { onSelectRow?: () => void } }) => (
    <>
      {children}
      {actions.onSelectRow ? (
        <button type="button" onClick={actions.onSelectRow}>
          {`menu: select ${entry.lead_name}`}
        </button>
      ) : null}
    </>
  ),
  InboxEntryMenuButton: () => null,
}));

import CrmInbox from "../CrmInbox";

const copy = ptMessages.crmInbox;
const MINUTE = 60_000;

function entry(id: string, name: string, extra: Partial<InboxEntry> = {}): InboxEntry {
  return {
    entry_id: id,
    entry_type: "whatsapp",
    lead_name: name,
    lead_number: "5511999990000",
    last_message_at: "2026-10-18T12:00:00Z",
    last_message_preview: `mensagem de ${name}`,
    unread_count: 0,
    conversation_status: "ongoing",
    ...extra,
  } as InboxEntry;
}

function controls(marks: PersonalMarks = NO_PERSONAL_MARKS): PersonalInboxControls {
  return {
    marks,
    pin: vi.fn(() => true),
    markUnread: vi.fn(() => true),
    clearUnreadMark: vi.fn(() => true),
    clearUnread: vi.fn(),
  };
}

const labels: Label[] = [{ id: "lb-vip", userId: "", name: "VIP", color: "#333", position: 0, createdAt: "", updatedAt: "" }];

function renderInbox(list: InboxEntry[], personal: PersonalInboxControls, extra: { searchResults?: InboxEntry[] | null } = {}) {
  const onSearch = vi.fn<(filters: WsSearchInboxPayload) => void>();
  const onClearSearch = vi.fn();
  const onSelect = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmInbox
        entries={list}
        selectedEntryId={null}
        onSelect={onSelect}
        connectionStatus="connected"
        translations={ptMessages.liveChat.inbox}
        personalInbox={personal}
        onSearch={onSearch}
        onClearSearch={onClearSearch}
        searchResults={extra.searchResults ?? null}
        labels={labels}
      />
    </NextIntlClientProvider>,
  );
  return { onSearch, onClearSearch, onSelect };
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-inbox-row]"));
}

function rowOf(name: string): HTMLElement {
  return rows().find((row) => within(row).queryAllByText(name).length > 0)!;
}

beforeEach(() => {
  sonner.toast.mockReset();
  sonner.toast.warning.mockReset();
  bulk.crmBulkAction.mockReset();
  try {
    window.localStorage.clear();
  } catch {
    return;
  }
});

describe("personal marks on the inbox rows", () => {
  it("puts pinned rows in a Fixadas group at the top and shows the pin", () => {
    const marks = withMark(NO_PERSONAL_MARKS, entry("b", "Bruno"), { pinned_at: "2026-10-18T10:00:00Z" });
    renderInbox([entry("a", "Ana"), entry("b", "Bruno")], controls(marks));
    expect(screen.getByText(copy.groups.pinned)).toBeInTheDocument();
    expect(rows()[0]).toBe(rowOf("Bruno"));
    expect(within(rowOf("Bruno")).getByLabelText(copy.row.pinned)).toBeInTheDocument();
  });

  it("shows a row marked unread as unread even with no unread messages", () => {
    const marks = withMark(NO_PERSONAL_MARKS, entry("a", "Ana"), { unread_marked_at: "2026-10-18T10:00:00Z" });
    renderInbox([entry("a", "Ana")], controls(marks));
    expect(within(rowOf("Ana")).getByLabelText(copy.row.markedUnread)).toBeInTheDocument();
    expect(within(rowOf("Ana")).getByText("Ana").closest(".text-sm")).toHaveClass("font-semibold");
  });

});

describe("personal shortcuts on the focused row", () => {
  it("pins with p and marks unread with u", async () => {
    const personal = controls();
    renderInbox([entry("a", "Ana")], personal);
    const row = rowOf("Ana");
    row.focus();
    fireEvent.keyDown(row, { key: "p" });
    expect(personal.pin).toHaveBeenCalledWith(expect.objectContaining({ entry_id: "a" }), true);
    await waitFor(() => expect(sonner.toast).toHaveBeenCalledWith(copy.personal.pinned, expect.objectContaining({ action: expect.objectContaining({ label: copy.personal.undo }) })));

    fireEvent.keyDown(row, { key: "u" });
    expect(personal.markUnread).toHaveBeenCalledWith(expect.objectContaining({ entry_id: "a" }));
  });
});

describe("waiting time on the rows", () => {
  it("says how long the customer waits from the server's waiting time and adds a warning mark past the threshold", () => {
    const waitingLong = entry("a", "Ana", { waiting_since: new Date(Date.now() - 20 * MINUTE).toISOString() });
    const waitingShort = entry("b", "Bruno", { waiting_since: new Date(Date.now() - 5 * MINUTE).toISOString() });
    const answered = entry("c", "Carla");
    renderInbox([waitingLong, waitingShort, answered], controls());
    expect(within(rowOf("Ana")).getByText("aguardando há 20 min")).toBeInTheDocument();
    expect(within(rowOf("Ana")).getByRole("img", { name: /15 minutos/ })).toBeInTheDocument();
    expect(within(rowOf("Bruno")).getByText("aguardando há 5 min")).toBeInTheDocument();
    expect(within(rowOf("Bruno")).queryByRole("img", { name: /15 minutos/ })).not.toBeInTheDocument();
    expect(within(rowOf("Carla")).queryByText(/aguardando/)).not.toBeInTheDocument();
  });

  it("shows nobody as waiting when the server sends no waiting time, whatever the message clocks say", () => {
    const fromOlderServer = { ...entry("a", "Ana"), last_customer_message_at: new Date(Date.now() - 20 * MINUTE).toISOString() } as InboxEntry;
    renderInbox([fromOlderServer], controls());
    expect(within(rowOf("Ana")).queryByText(/aguardando/)).not.toBeInTheDocument();
  });

  it("sorts by the longest wait on the server and remembers the choice", async () => {
    const { onSearch } = renderInbox([entry("a", "Ana")], controls());
    fireEvent.pointerDown(screen.getByRole("button", { name: new RegExp(copy.sort.label) }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: copy.sort.waiting }));
    expect(onSearch).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "waiting" }));
    expect(window.localStorage.getItem("crm.inbox.sort.u-ana")).toBe("waiting");
  });
});

describe("label filter", () => {
  it("sends the chosen label to the server search", () => {
    const { onSearch } = renderInbox([entry("a", "Ana")], controls());
    fireEvent.click(screen.getByTitle("Filtros avançados"));
    fireEvent.change(screen.getByLabelText(copy.filters.label), { target: { value: "lb-vip" } });
    fireEvent.click(screen.getByText("Aplicar filtros"));
    expect(onSearch).toHaveBeenLastCalledWith(expect.objectContaining({ label_id: "lb-vip" }));
  });
});

describe("selection mode in the classic inbox", () => {
  const list = [entry("a", "Ana"), entry("b", "Bruno"), entry("c", "Carla"), entry("d", "Davi")];

  function checkbox(name: string): HTMLElement {
    return screen.getByRole("checkbox", { name: copy.row.select.replace("{name}", name) });
  }

  function selectAll(): HTMLElement {
    return screen.getByRole("checkbox", { name: copy.bulk.selectAll });
  }

  function startSelecting() {
    fireEvent.click(screen.getByRole("button", { name: copy.select.start }));
  }

  it("shows no checkbox until the operator starts selecting, then one per row beside the avatar, never over it", () => {
    renderInbox(list, controls());
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
    expect(document.querySelectorAll("[data-row-avatar] [role=checkbox]")).toHaveLength(0);

    startSelecting();

    expect(screen.getByText(copy.select.entered)).toBeInTheDocument();
    for (const name of ["Ana", "Bruno", "Carla", "Davi"]) {
      const box = checkbox(name);
      const avatar = rowOf(name).querySelector("[data-row-avatar]")!;
      expect(avatar.contains(box)).toBe(false);
      expect(box.compareDocumentPosition(avatar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(document.querySelectorAll("[data-row-avatar] [role=checkbox]")).toHaveLength(0);
    expect(screen.getByText("Nenhuma selecionada")).toBeInTheDocument();
  });

  it("toggles a row on click instead of opening the conversation", () => {
    const { onSelect } = renderInbox(list, controls());
    startSelecting();
    fireEvent.click(rowOf("Bruno"));
    expect(checkbox("Bruno")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(rowOf("Bruno"));
    expect(checkbox("Bruno")).toHaveAttribute("aria-checked", "false");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens the conversation on click outside selection mode", () => {
    const { onSelect } = renderInbox(list, controls());
    fireEvent.click(rowOf("Bruno"));
    expect(onSelect).toHaveBeenCalledWith("b", "whatsapp", "pointer");
  });

  it("selects every row between the last pick and a Shift+click", () => {
    renderInbox(list, controls());
    startSelecting();
    fireEvent.click(checkbox("Ana"));
    fireEvent.click(rowOf("Carla"), { shiftKey: true });
    expect(screen.getByText("3 selecionadas")).toBeInTheDocument();
    expect(checkbox("Bruno")).toHaveAttribute("aria-checked", "true");
    expect(checkbox("Davi")).toHaveAttribute("aria-checked", "false");
  });

  it("selects and clears every loaded row from the header checkbox, showing mixed when only some are picked", () => {
    renderInbox(list, controls());
    startSelecting();
    expect(selectAll()).toHaveAttribute("aria-checked", "false");
    fireEvent.click(checkbox("Ana"));
    expect(selectAll()).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(selectAll());
    expect(selectAll()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("4 selecionadas")).toBeInTheDocument();
    fireEvent.click(selectAll());
    expect(selectAll()).toHaveAttribute("aria-checked", "false");
    expect(checkbox("Ana")).toHaveAttribute("aria-checked", "false");
  });

  it("leaves selection mode and forgets the picks with Esc", () => {
    renderInbox(list, controls());
    startSelecting();
    fireEvent.click(checkbox("Ana"));
    const row = rowOf("Ana");
    row.focus();
    fireEvent.keyDown(row, { key: "Escape" });
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.getByText(copy.select.left)).toBeInTheDocument();
    startSelecting();
    expect(checkbox("Ana")).toHaveAttribute("aria-checked", "false");
  });

  it("leaves selection mode with Cancelar", () => {
    renderInbox(list, controls());
    startSelecting();
    fireEvent.click(checkbox("Ana"));
    fireEvent.click(within(screen.getByRole("toolbar")).getByRole("button", { name: copy.bulk.cancel }));
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
    expect(screen.getByRole("button", { name: copy.select.start })).toHaveFocus();
  });

  it("leaves selection mode with Esc from the toolbar and gives focus back to Selecionar", () => {
    renderInbox(list, controls());
    startSelecting();
    expect(screen.getByRole("button", { name: copy.select.start })).toHaveAttribute("aria-pressed", "true");
    selectAll().focus();
    fireEvent.keyDown(selectAll(), { key: "Escape" });
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.select.start })).toHaveFocus();
    expect(screen.getByRole("button", { name: copy.select.start })).toHaveAttribute("aria-pressed", "false");
  });

  it("starts selecting with the focused row on x, then toggles it with Space or x", () => {
    const { onSelect } = renderInbox(list, controls());
    const row = rowOf("Bruno");
    row.focus();
    fireEvent.keyDown(row, { key: "x" });
    expect(checkbox("Bruno")).toHaveAttribute("aria-checked", "true");
    expect(checkbox("Ana")).toHaveAttribute("aria-checked", "false");
    fireEvent.keyDown(row, { key: " " });
    expect(checkbox("Bruno")).toHaveAttribute("aria-checked", "false");
    fireEvent.keyDown(row, { key: "x" });
    expect(checkbox("Bruno")).toHaveAttribute("aria-checked", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("starts selecting with a row chosen from its menu", () => {
    renderInbox(list, controls());
    fireEvent.click(screen.getByRole("button", { name: "menu: select Carla" }));
    expect(checkbox("Carla")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1 selecionada")).toBeInTheDocument();
  });

  it("offers the bulk actions once a conversation is picked", () => {
    renderInbox(list, controls());
    startSelecting();
    expect(within(screen.getByRole("toolbar")).queryByRole("button", { name: copy.bulk.markRead })).not.toBeInTheDocument();
    fireEvent.click(checkbox("Ana"));
    expect(within(screen.getByRole("toolbar")).getByRole("button", { name: copy.bulk.markRead })).toBeEnabled();
  });

  it("marks the picked conversations read in one bulk call, sums up failures in one toast and leaves selection mode", async () => {
    const personal = controls();
    bulk.crmBulkAction.mockResolvedValue({ result: { succeeded: 1, failed: [{ entryId: "b", error: "outside scope" }], eligible: 2 } });
    renderInbox(list, personal);
    startSelecting();
    fireEvent.click(checkbox("Ana"));
    fireEvent.click(checkbox("Bruno"));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("toolbar")).getByRole("button", { name: copy.bulk.markRead }));
    });
    expect(bulk.crmBulkAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "mark_read",
        mode: "ids",
        targets: [
          { entryId: "a", entryType: "whatsapp" },
          { entryId: "b", entryType: "whatsapp" },
        ],
      }),
    );
    await waitFor(() => expect(sonner.toast.warning).toHaveBeenCalledTimes(1));
    expect(personal.clearUnread).toHaveBeenCalledWith([{ entry_id: "a", entry_type: "whatsapp" }]);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
  });
});

describe("viewers on the rows", () => {
  it("shows the teammates viewing a conversation this client has open, and nobody on the others", () => {
    crm.viewersByEntry = new Map([
      [
        "whatsapp-a",
        [
          { user_id: "u-ana", name: "Ana Operadora" },
          { user_id: "u-bruno", name: "Bruno Lima" },
        ],
      ],
    ]);
    renderInbox([entry("a", "Ana"), entry("b", "Bruno")], controls());
    expect(within(rowOf("Ana")).getByRole("img", { name: "Bruno Lima está vendo" })).toBeInTheDocument();
    expect(within(rowOf("Ana")).queryByRole("img", { name: /Ana Operadora/ })).toBeNull();
    expect(within(rowOf("Bruno")).queryByRole("img", { name: /está vendo/ })).toBeNull();
    crm.viewersByEntry = new Map();
  });
});
