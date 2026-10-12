import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import type { StudioAssistantContext } from "@/lib/aichat/assistant-context";
import { isDockOpen, setDockOpen } from "@/lib/aichat/dock-state";
import type { ChatAttachment } from "@/lib/aichat/types";

const files = vi.hoisted(() => ({ attach: vi.fn() }));

vi.mock("@/app/actions/aichat", () => ({
  listChatThreadsAction: vi.fn(async () => ({ data: { items: [], total: 0, page: 1, pageSize: 30 }, error: null })),
  deleteChatThreadAction: vi.fn(),
  getChatMessagesAction: vi.fn(),
  getChatThreadCostAction: vi.fn(async () => ({ data: null, error: null })),
  createChatThreadAction: vi.fn(),
  stopChatTurnAction: vi.fn(),
  queueChatMessageAction: vi.fn(),
  unqueueChatMessageAction: vi.fn(),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, permissionsLoading: false, can: () => true }),
}));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/studio/image/p-open",
  Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("./use-chat-model", () => ({ useChatModel: () => ({ model: "test", models: ["test"], pricing: [], changeModel: vi.fn() }) }));
vi.mock("./use-chat-attachments", () => ({ useChatAttachments: () => ({ items: [], ready: [], uploading: false, error: null, clear: vi.fn(), add: vi.fn(), attach: files.attach, remove: vi.fn() }) }));
vi.mock("./use-stick-to-bottom", () => ({ useStickToBottom: () => ({ scrollRef: { current: null }, onScroll: vi.fn(), showScrollDown: false, scrollToBottom: vi.fn() }) }));
vi.mock("./voice/use-voice-mode", () => ({ useVoiceMode: () => ({ disable: vi.fn(), enable: vi.fn(), phase: "off", supported: false }) }));
vi.mock("@/components/elevated-design/ai-model-selector", () => ({ AIModelSelector: () => <span>Test model</span> }));

import { usePublishAssistantContext } from "./assistant-context";
import { AssistantDock } from "./assistant-dock";
import { handOffToElo } from "./elo-handoff";

const studio: StudioAssistantContext = { kind: "studio", view: { surface: "studio", projectId: "p-open", projectKind: "image" }, projectName: "Campanha" };
const photo: ChatAttachment = { mediaId: "m-1", name: "Foto", kind: "image", url: "blob:foto" };
const prompt = 'Sobre a seleção no design: "Foto" (Imagem, id l_1)\n';

function StudioScreen() {
  usePublishAssistantContext(studio);
  return null;
}

function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StudioScreen />
      <AssistantDock />
    </NextIntlClientProvider>,
  );
}

const composer = () => screen.getByRole("textbox", { name: en.aiChatPage.inputPlaceholder }) as HTMLTextAreaElement;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  act(() => setDockOpen(false));
});

afterEach(() => {
  cleanup();
  act(() => setDockOpen(false));
});

describe("handing a studio selection to Elo", () => {
  it("opens the dock with the prompt in the composer and the image attached, without sending anything", { timeout: 15_000 }, async () => {
    mount();
    act(() => handOffToElo({ projectId: "p-open", prompt, attachments: [photo] }));
    expect(isDockOpen()).toBe(true);
    await waitFor(() => expect(composer().value).toBe(prompt));
    expect(files.attach).toHaveBeenCalledWith(photo);
    await waitFor(() => expect(composer()).toHaveFocus());
  });

  it("keeps a draft the person already typed and adds the prompt below it", { timeout: 15_000 }, async () => {
    act(() => setDockOpen(true));
    mount();
    fireEvent.change(composer(), { target: { value: "meu rascunho" } });
    act(() => handOffToElo({ projectId: "p-open", prompt, attachments: [] }));
    await waitFor(() => expect(composer().value).toBe(`meu rascunho\n\n${prompt}`));
  });

  it("ignores a hand-off made for a project this dock is not bound to", { timeout: 15_000 }, async () => {
    act(() => setDockOpen(true));
    mount();
    act(() => handOffToElo({ projectId: "p-other", prompt, attachments: [photo] }));
    expect(composer().value).toBe("");
    expect(files.attach).not.toHaveBeenCalled();
  });
});
