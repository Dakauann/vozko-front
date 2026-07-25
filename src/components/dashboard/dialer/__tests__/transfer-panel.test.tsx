/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TransferPanel } from "../transfer-panel";
import type { DialerPresenceEntry } from "@/hooks/use-dialer-ws";
import type { WorkspaceMember } from "@/lib/workspace/types";

// The picker resolves copy / group headings / endpoint labels through next-intl;
// a passthrough that echoes the key (and appends any interpolated values) keeps
// the tests focused on names and behavior, not the translated copy itself.
vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(" ")}` : key,
}));

function mkMember(
  userId: string,
  username: string,
  email: string,
): WorkspaceMember {
  return {
    id: `m-${userId}`,
    workspaceId: "ws-1",
    userId,
    role: "member" as WorkspaceMember["role"],
    email,
    username,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

const members: WorkspaceMember[] = [
  mkMember("u-alice", "Alice Costa", "alice@x.com"),
  mkMember("u-bruno", "Bruno Lima", "bruno@x.com"),
  mkMember("u-carla", "Carla Souza", "carla@x.com"),
];

const presence: DialerPresenceEntry[] = [
  { userId: "u-alice", username: "Alice Costa", busy: false, hasBrowser: true, hasBranch: false },
  { userId: "u-bruno", username: "Bruno Lima", busy: false, hasBrowser: false, hasBranch: true },
  { userId: "u-carla", username: "Carla Souza", busy: false, hasBrowser: true, hasBranch: true },
];

const baseProps = {
  outgoingTransfer: null,
  members,
  presence,
  selfUserId: "u-self",
  refreshTargets: vi.fn(),
  initiate: vi.fn(),
  completeAttended: vi.fn(),
  cancelAttended: vi.fn(),
  enabled: true,
};

describe("TransferPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("hides the CTA entirely when canTransfer=false", () => {
      render(<TransferPanel {...baseProps} canTransfer={false} />);
      expect(screen.queryByRole("button", { name: /transfer/i })).toBeNull();
    });

    it("shows the CTA when canTransfer is true (default)", () => {
      render(<TransferPanel {...baseProps} />);
      expect(
        screen.getByRole("button", { name: /transfer/i }),
      ).toBeInTheDocument();
    });

    it("falls back to manual user_id entry when canListMembers=false", () => {
      render(<TransferPanel {...baseProps} canTransfer canListMembers={false} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      expect(screen.queryByPlaceholderText(/searchPlaceholder/i)).toBeNull();
      expect(
        screen.getByLabelText(/targetIdLabel/i),
      ).toBeInTheDocument();
    });

    it("invokes initiate with the manually entered user_id", () => {
      const initiate = vi.fn();
      render(
        <TransferPanel
          {...baseProps}
          initiate={initiate}
          canTransfer
          canListMembers={false}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      const input = screen.getByLabelText(/targetIdLabel/i);
      fireEvent.change(input, { target: { value: "u-zelda" } });

      const ctas = screen.getAllByRole("button", { name: /transfer/i });
      fireEvent.click(ctas[ctas.length - 1]);

      expect(initiate).toHaveBeenCalledTimes(1);
      expect(initiate).toHaveBeenCalledWith("u-zelda", "blind");
    });
  });

  describe("searchable picker", () => {
    it("renders all available members when search is empty", () => {
      render(<TransferPanel {...baseProps} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      expect(screen.getByText("Alice Costa")).toBeInTheDocument();
      expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
      expect(screen.getByText("Carla Souza")).toBeInTheDocument();
    });

    it("filters by name substring (case-insensitive)", () => {
      render(<TransferPanel {...baseProps} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      const input = screen.getByPlaceholderText(/searchPlaceholder/i);
      fireEvent.change(input, { target: { value: "bru" } });

      expect(screen.queryByText("Alice Costa")).toBeNull();
      expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
      expect(screen.queryByText("Carla Souza")).toBeNull();
    });

    it("filters by userId substring", () => {
      render(<TransferPanel {...baseProps} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      const input = screen.getByPlaceholderText(/searchPlaceholder/i);
      fireEvent.change(input, { target: { value: "u-car" } });

      expect(screen.queryByText("Alice Costa")).toBeNull();
      expect(screen.queryByText("Bruno Lima")).toBeNull();
      expect(screen.getByText("Carla Souza")).toBeInTheDocument();
    });

    it("shows empty state when no members match the search", () => {
      render(<TransferPanel {...baseProps} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      const input = screen.getByPlaceholderText(/searchPlaceholder/i);
      fireEvent.change(input, { target: { value: "zzznomatch" } });

      expect(
        screen.getByText(/emptyFiltered/i),
      ).toBeInTheDocument();
    });

    it("invokes initiate(targetUserId, kind) when a target is picked", () => {
      const initiate = vi.fn();
      render(<TransferPanel {...baseProps} initiate={initiate} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      fireEvent.click(screen.getByText("Bruno Lima"));

      expect(initiate).toHaveBeenCalledWith("u-bruno", "blind");
    });

    it("resolves the display name from email when username is blank (no 'Agente' fallback)", () => {
      const blankMembers = [mkMember("u-x", "", "xavier@x.com")];
      const blankPresence: DialerPresenceEntry[] = [
        { userId: "u-x", username: "", busy: false, hasBrowser: true, hasBranch: false },
      ];
      render(
        <TransferPanel
          {...baseProps}
          members={blankMembers}
          presence={blankPresence}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      expect(screen.getByText("xavier@x.com")).toBeInTheDocument();
      expect(screen.queryByText("Agente")).toBeNull();
    });

    it("excludes self and shows busy members as non-selectable", () => {
      const initiate = vi.fn();
      const withSelfAndBusy: DialerPresenceEntry[] = [
        { userId: "u-alice", username: "Alice Costa", busy: false, hasBrowser: true, hasBranch: false },
        { userId: "u-bruno", username: "Bruno Lima", busy: true, hasBrowser: false, hasBranch: true },
        { userId: "u-self", username: "Me", busy: false, hasBrowser: true, hasBranch: false },
      ];
      const withSelf = [...members, mkMember("u-self", "Me", "me@x.com")];
      render(
        <TransferPanel
          {...baseProps}
          members={withSelf}
          presence={withSelfAndBusy}
          initiate={initiate}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      // Self is never a transfer target.
      expect(screen.queryByText("Me")).toBeNull();
      // Busy members appear but cannot be selected.
      const bruno = screen.getByText("Bruno Lima");
      fireEvent.click(bruno);
      expect(initiate).not.toHaveBeenCalled();
      // Available members remain selectable.
      fireEvent.click(screen.getByText("Alice Costa"));
      expect(initiate).toHaveBeenCalledWith("u-alice", "blind");
    });

    it("camp-on: a busy member IS selectable for a blind transfer when the queue is enabled", () => {
      const initiate = vi.fn();
      const withBusy: DialerPresenceEntry[] = [
        { userId: "u-alice", username: "Alice Costa", busy: false, hasBrowser: true, hasBranch: false },
        { userId: "u-bruno", username: "Bruno Lima", busy: true, hasBrowser: true, hasBranch: false },
      ];
      render(
        <TransferPanel
          {...baseProps}
          presence={withBusy}
          initiate={initiate}
          queueEnabled
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));
      // Blind is the default kind; picking the busy member queues them (camp-on).
      fireEvent.click(screen.getByText("Bruno Lima"));
      expect(initiate).toHaveBeenCalledWith("u-bruno", "blind");
    });

    it("camp-on does NOT apply to attended: a busy member stays non-selectable even with the queue enabled", () => {
      const initiate = vi.fn();
      const withBusy: DialerPresenceEntry[] = [
        { userId: "u-alice", username: "Alice Costa", busy: false, hasBrowser: true, hasBranch: false },
        { userId: "u-bruno", username: "Bruno Lima", busy: true, hasBrowser: true, hasBranch: false },
      ];
      render(
        <TransferPanel
          {...baseProps}
          presence={withBusy}
          initiate={initiate}
          queueEnabled
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));
      fireEvent.click(screen.getByRole("button", { name: /attended/i }));
      // A consult needs the target free NOW, so a busy member cannot be queued.
      fireEvent.click(screen.getByText("Bruno Lima"));
      expect(initiate).not.toHaveBeenCalled();
    });

    it("shows empty-state copy when there are no transferable members", () => {
      render(<TransferPanel {...baseProps} members={[]} presence={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

      const list = screen.getByRole("listbox");
      expect(
        within(list).getByText(/emptyNone/i),
      ).toBeInTheDocument();
    });

    it("allows a branch-only member for an attended transfer (ramais support consult)", () => {
      const initiate = vi.fn();
      // Bruno is branch-only (hasBranch, no browser); a ramal can host a consult.
      render(<TransferPanel {...baseProps} initiate={initiate} />);
      fireEvent.click(screen.getByRole("button", { name: /transfer/i }));
      fireEvent.click(screen.getByRole("button", { name: /attended/i }));
      fireEvent.click(screen.getByText("Bruno Lima"));
      expect(initiate).toHaveBeenCalledWith("u-bruno", "attended");
    });
  });

  describe("pending offer banner", () => {
    const pending = (kind: "blind" | "attended") => ({
      transferId: "t-1",
      callId: "c-1",
      targetUserId: "u-bruno",
      kind,
      stage: "pending_offer" as const,
      startedAt: Date.now(),
    });

    it("blind: shows hold-music hint and a working Cancelar (pull the caller back)", () => {
      const cancelAttended = vi.fn();
      render(
        <TransferPanel
          {...baseProps}
          outgoingTransfer={pending("blind")}
          cancelAttended={cancelAttended}
        />,
      );
      expect(screen.getByText(/blindMusicHint/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /complete/i })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(cancelAttended).toHaveBeenCalledWith("t-1", "initiator_cancelled");
    });

    it("attended: also offers 'Concluir já' (blond, complete while ringing)", () => {
      const completeAttended = vi.fn();
      render(
        <TransferPanel
          {...baseProps}
          outgoingTransfer={pending("attended")}
          completeAttended={completeAttended}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /completeNow/i }));
      expect(completeAttended).toHaveBeenCalledWith("t-1");
    });
  });

  describe("consulting banner", () => {
    it("offers Concluir and Cancelar wired to the transfer id", () => {
      const completeAttended = vi.fn();
      const cancelAttended = vi.fn();
      render(
        <TransferPanel
          {...baseProps}
          outgoingTransfer={{
            transferId: "t-9",
            callId: "c-1",
            targetUserId: "u-bruno",
            kind: "attended",
            stage: "consulting",
            startedAt: Date.now(),
          }}
          completeAttended={completeAttended}
          cancelAttended={cancelAttended}
        />,
      );
      expect(screen.getByText(/consulting bruno lima/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /complete/i }));
      expect(completeAttended).toHaveBeenCalledWith("t-9");
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(cancelAttended).toHaveBeenCalledWith("t-9");
    });
  });
});
