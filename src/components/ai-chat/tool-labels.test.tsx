import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-access", () => ({ useAccess: () => ({ decideScreen: () => ({ status: "allowed" }) }) }));
vi.mock("@/hooks/use-open-in-studio", () => ({ useOpenInStudio: () => ({ open: vi.fn(), opening: null }) }));

import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import type { ChatMessage } from "@/lib/aichat/types";

import { hydrate, type UIMessage } from "@/lib/aichat/ui-message";

import { MessageBubble, useBubbleLabels } from "./message-list";
import { useScreenReveal } from "./screen-bridge";

function Bubble({ message }: { message: UIMessage }) {
  return <MessageBubble message={message} live={false} onApprove={vi.fn()} onReject={vi.fn()} onEditImage={vi.fn()} labels={useBubbleLabels()} />;
}

function renderIn(locale: "pt" | "en", message: UIMessage) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "pt" ? ptMessages : enMessages}>
      <Bubble message={message} />
    </NextIntlClientProvider>,
  );
}

const base = { id: "a-1", role: "assistant", content: "", createdAt: "2026-10-08T12:00:00Z" } as const;

describe("tool names in the chat", () => {
  it("translates every studio tool instead of showing its code name", () => {
    renderIn("pt", { ...base, segments: [{ kind: "tool", name: "studio_edit_video", summary: "ok", ok: true }] });
    expect(screen.queryByText(/studio edit video/i)).toBeNull();
    expect(screen.getByText(ptMessages.aiChatPage.tools.studio_edit_video)).toBeTruthy();
  });

  it("names the skill Elo consulted, in the reader's language, also after a reload", () => {
    const stored = {
      id: "m-1",
      role: "assistant",
      content: "",
      createdAt: "2026-10-08T12:00:00Z",
      tools: [{ name: "load_skill", summary: "ok", ok: true, subject: { kind: "skill", key: "motion-design", label: "Motion design no Estúdio" } }],
    } as unknown as ChatMessage;
    renderIn("en", hydrate(stored));
    expect(screen.getByText(enMessages.aiChatPage.tools.load_skill)).toBeTruthy();
    expect(screen.getByText(new RegExp(enMessages.aiChatPage.subjects.skill["motion-design"]))).toBeTruthy();
  });

  it("falls back to the label the server sent for a skill it does not know", () => {
    renderIn("pt", { ...base, segments: [{ kind: "tool", name: "load_skill", summary: "ok", ok: true, subject: { kind: "skill", key: "nova", label: "Habilidade nova" } }] });
    expect(screen.getByText(/Habilidade nova/)).toBeTruthy();
  });
});

describe("the look step in the chat", () => {
  const look = (target: Record<string, unknown>) => ({ ...base, segments: [{ kind: "tool" as const, name: "studio_look", summary: "ok", ok: true, subject: { kind: "studio_look", key: String(target.kind), label: "", target: { projectId: "p-1", ...target } } as never }] });

  it("names the artboard she looked at, in the reader's language", () => {
    renderIn("pt", look({ kind: "artboard", artboardId: "ab-2", n: 2 }));
    expect(screen.getByText("Vendo Prancheta 2")).toBeTruthy();
  });

  it("keeps the artboard's own name and names a stretch of the video", () => {
    const { unmount } = renderIn("en", look({ kind: "artboard", artboardId: "ab-2", n: 2, name: "Cover" }));
    expect(screen.getByText("Looking at Cover")).toBeTruthy();
    unmount();
    renderIn("en", look({ kind: "moments", fromMs: 3000, toMs: 5000 }));
    expect(screen.getByText("Looking at 0:03 to 0:05")).toBeTruthy();
  });

  it("is plain text while the project is not open, and takes the editor there once it is", () => {
    const { unmount } = renderIn("pt", look({ kind: "moments", fromMs: 3000, toMs: 5000 }));
    expect(screen.queryByRole("button", { name: /Vendo 0:03 a 0:05/ })).toBeNull();
    unmount();
    const reveal = vi.fn();
    const editor = renderHook(() => useScreenReveal("p-1", reveal));
    renderIn("pt", look({ kind: "moments", fromMs: 3000, toMs: 5000 }));
    fireEvent.click(screen.getByRole("button", { name: /Vendo 0:03 a 0:05/ }));
    expect(reveal).toHaveBeenCalledWith(expect.objectContaining({ kind: "moments", fromMs: 3000, toMs: 5000 }));
    editor.unmount();
  });

  it("does not offer to reveal a look at the whole sheet", () => {
    const editor = renderHook(() => useScreenReveal("p-1", vi.fn()));
    renderIn("pt", look({ kind: "artboards" }));
    expect(screen.getByText("Vendo todas as pranchetas")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Vendo/ })).toBeNull();
    editor.unmount();
  });
});
