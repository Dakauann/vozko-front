import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ShortcutVariableValues } from "@/lib/message-shortcuts/variables";
import CrmMessageInput from "../CrmMessageInput";
import { FakeMediaRecorder, grantedMicrophone, installFakeRecorder, refusedMicrophone } from "@/test/fake-media-recorder";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  listShortcuts: vi.fn(),
  variables: { current: {} as ShortcutVariableValues },
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: mocks.upload }));
vi.mock("@/app/actions/message-shortcuts", () => ({ listMessageShortcutsAction: mocks.listShortcuts }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true, currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/contexts/auth-context", () => ({
  useSignedInUserId: () => "user-1",
  useSignedInUserName: () => "Ana",
}));
vi.mock("@/contexts/crm-context", async () => {
  const { crmShowing, subscribedConversation } = await import("@/test/composer-media-limits");
  const crm = crmShowing(subscribedConversation("entry-1", "whatsapp"));
  return { useOptionalCrm: () => crm };
});
vi.mock("@/hooks/use-shortcut-variable-values", () => ({
  useShortcutVariableValues: () => mocks.variables.current,
}));
vi.mock("frimousse", () => ({
  EmojiPicker: {
    Root: ({ onEmojiSelect }: { onEmojiSelect: (emoji: { emoji: string }) => void }) => (
      <button type="button" onClick={() => onEmojiSelect({ emoji: "😀" })}>
        pick-grin
      </button>
    ),
    Search: () => null,
    Viewport: () => null,
    Loading: () => null,
    Empty: () => null,
    List: () => null,
  },
}));

const inputT = ptMessages.whatsappCampaignsPage.detail.crm.input;
const composerT = ptMessages.crmComposer;

type Props = Partial<React.ComponentProps<typeof CrmMessageInput>>;

function composer(props: Props = {}) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmMessageInput
        entryType="whatsapp"
        entryId="entry-1"
        onSend={vi.fn()}
        onSendMedia={vi.fn()}
        onTyping={vi.fn()}
        windowOpen
        windowExpiresAt={null}
        translations={inputT}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

function textarea(): HTMLTextAreaElement {
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function pickFiles(container: HTMLElement, files: File[]) {
  fireEvent.change(fileInput(container), { target: { files } });
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.variables.current = {};
  mocks.upload.mockReset();
  mocks.listShortcuts.mockReset();
  let counter = 0;
  mocks.upload.mockImplementation(async () => ({ mediaId: `media-${++counter}` }));
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("composer drafts", () => {
  it("brings back what the operator was typing when the conversation opens again", () => {
    const first = render(composer());
    fireEvent.change(textarea(), { target: { value: "Seu boleto vence amanhã" } });
    first.unmount();

    render(composer());
    expect(textarea()).toHaveValue("Seu boleto vence amanhã");
  });

  it("forgets the draft once the message is handed over for sending", () => {
    const onSend = vi.fn();
    const first = render(composer({ onSend }));
    fireEvent.change(textarea(), { target: { value: "Pronto" } });
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Pronto", false, undefined);
    first.unmount();

    render(composer());
    expect(textarea()).toHaveValue("");
  });

  it("keeps drafts per conversation", () => {
    const first = render(composer());
    fireEvent.change(textarea(), { target: { value: "Para a Carla" } });
    first.unmount();

    render(composer({ entryId: "entry-2" }));
    expect(textarea()).toHaveValue("");
  });

  it("restores an attachment that had already uploaded", async () => {
    const first = render(composer());
    pickFiles(first.container, [new File(["x"], "boleto.pdf", { type: "application/pdf" })]);
    await waitFor(() => expect(screen.queryByText(composerT.attachments.uploading)).not.toBeInTheDocument());
    first.unmount();

    render(composer());
    expect(screen.getByText("boleto.pdf")).toBeInTheDocument();
  });
});

describe("several attachments", () => {
  it("sends each attachment on its own, in order, with the text as the caption of the first that takes one", async () => {
    const onSendMedia = vi.fn();
    const onSend = vi.fn();
    const { container } = render(composer({ onSendMedia, onSend }));

    pickFiles(container, [
      new File(["a"], "nota.ogg", { type: "audio/ogg" }),
      new File(["b"], "foto.png", { type: "image/png" }),
      new File(["c"], "contrato.pdf", { type: "application/pdf" }),
    ]);
    await waitFor(() => expect(screen.queryByText(composerT.attachments.uploading)).not.toBeInTheDocument());

    fireEvent.change(textarea(), { target: { value: "segue" } });
    fireEvent.click(screen.getByRole("button", { name: inputT.sendButton }));

    expect(onSendMedia.mock.calls).toEqual([
      ["", "media-1", "audio", false, undefined],
      ["segue", "media-2", "image", false, undefined],
      ["", "media-3", "document", false, undefined],
    ]);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByText("foto.png")).not.toBeInTheDocument();
  });

  it("waits for every upload before allowing the send", async () => {
    let finish: (value: { mediaId: string }) => void = () => {};
    mocks.upload.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const { container } = render(composer());

    pickFiles(container, [new File(["b"], "foto.png", { type: "image/png" })]);
    expect(await screen.findByText(composerT.attachments.uploading)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: inputT.sendButton })).toBeDisabled();

    await act(async () => finish({ mediaId: "media-9" }));
    expect(screen.getByRole("button", { name: inputT.sendButton })).not.toBeDisabled();
  });

  it("lets the operator listen to a recorded voice note in the strip before sending", async () => {
    const { container } = render(composer());
    pickFiles(container, [new File(["a"], "audio-message.wav", { type: "audio/wav" })]);
    expect(await screen.findByRole("group", { name: composerT.attachments.voiceNotePreview })).toBeInTheDocument();
  });

  it("removes a queued attachment", async () => {
    const { container } = render(composer());
    pickFiles(container, [new File(["b"], "foto.png", { type: "image/png" })]);
    await screen.findByText("foto.png");
    fireEvent.click(screen.getByRole("button", { name: "Remover foto.png" }));
    expect(screen.queryByText("foto.png")).not.toBeInTheDocument();
  });

  it("accepts files handed over by a drop on the thread", async () => {
    const control = { current: null as null | { attachFiles: (files: File[]) => void } };
    render(composer({ controlRef: control as never }));
    act(() => control.current?.attachFiles([new File(["b"], "solto.png", { type: "image/png" })]));
    expect(await screen.findByText("solto.png")).toBeInTheDocument();
  });
});

describe("reply target", () => {
  it("quotes the reply target on the first part of a multi part send only, then lets it go", async () => {
    const onSendMedia = vi.fn();
    const onSend = vi.fn();
    const onClearReply = vi.fn();
    const { container } = render(
      composer({
        onSendMedia,
        onSend,
        onClearReply,
        replyToMessage: { id: "msg-1", sender_name: "Carla", from: "5511", text: "oi" },
      }),
    );

    pickFiles(container, [
      new File(["a"], "nota.ogg", { type: "audio/ogg" }),
      new File(["b"], "foto.png", { type: "image/png" }),
    ]);
    await waitFor(() => expect(screen.queryByText(composerT.attachments.uploading)).not.toBeInTheDocument());
    fireEvent.change(textarea(), { target: { value: "segue" } });
    fireEvent.click(screen.getByRole("button", { name: inputT.sendButton }));

    expect(onSendMedia.mock.calls).toEqual([
      ["", "media-1", "audio", false, "msg-1"],
      ["segue", "media-2", "image", false, undefined],
    ]);
    expect(onClearReply).toHaveBeenCalled();
  });

  it("cancels the reply with Esc", () => {
    const onClearReply = vi.fn();
    render(
      composer({
        replyToMessage: { id: "msg-1", sender_name: "Carla", from: "5511", text: "oi" },
        onClearReply,
      }),
    );
    fireEvent.keyDown(textarea(), { key: "Escape" });
    expect(onClearReply).toHaveBeenCalled();
  });
});

describe("quick replies", () => {
  const shortcut = {
    id: "s1",
    workspaceId: "ws-1",
    shortcut: "oi",
    name: "Saudação",
    messageType: "text" as const,
    content: { text: "Oi {{primeiro_nome}}, aqui é {{atendente}}." },
    createdAt: "",
    updatedAt: "",
  };

  beforeEach(() => {
    mocks.listShortcuts.mockResolvedValue({ shortcuts: [shortcut] });
  });

  it("inserts the chosen reply with its variables filled, for editing instead of sending", async () => {
    mocks.variables.current = { leadName: "Maria Clara", operatorName: "Ana" };
    const onSend = vi.fn();
    render(composer({ onSend }));

    fireEvent.change(textarea(), { target: { value: "/oi" } });
    await screen.findByText("/oi");
    await act(async () => {});
    fireEvent.keyDown(window, { key: "Tab" });

    expect(textarea()).toHaveValue("Oi Maria, aqui é Ana.");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps a variable it cannot fill visible and refuses to send it to the customer", async () => {
    mocks.variables.current = { operatorName: "Ana" };
    const onSend = vi.fn();
    render(composer({ onSend }));

    fireEvent.change(textarea(), { target: { value: "/oi" } });
    await screen.findByText("/oi");
    await act(async () => {});
    fireEvent.keyDown(window, { key: "Enter" });

    expect(textarea()).toHaveValue("Oi {{primeiro_nome}}, aqui é Ana.");
    expect(screen.getByText(composerT.variables.unresolved)).toBeInTheDocument();
    expect(screen.getByText("{{primeiro_nome}}")).toBeInTheDocument();

    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: inputT.sendButton })).toBeDisabled();
  });
});

describe("send and finish", () => {
  it("sends, then asks to finish, on Ctrl+Shift+Enter", () => {
    const calls: string[] = [];
    render(composer({ onSend: () => calls.push("send"), onSendAndFinish: () => calls.push("finish") }));
    fireEvent.change(textarea(), { target: { value: "Obrigado!" } });
    fireEvent.keyDown(textarea(), { key: "Enter", ctrlKey: true, shiftKey: true });
    expect(calls).toEqual(["send", "finish"]);
  });

  it("finishes nothing when there is nothing it may send", () => {
    const onSendAndFinish = vi.fn();
    render(composer({ onSendAndFinish }));
    fireEvent.change(textarea(), { target: { value: "Oi {{nome}}" } });
    fireEvent.keyDown(textarea(), { key: "Enter", ctrlKey: true, shiftKey: true });
    expect(onSendAndFinish).not.toHaveBeenCalled();
  });
});

describe("window closed", () => {
  it("offers to send a template now beside the template schedule", () => {
    const onSendTemplateNow = vi.fn();
    render(composer({ windowOpen: false, onScheduleTemplate: vi.fn(), onSendTemplateNow }));
    fireEvent.click(screen.getByRole("button", { name: composerT.sendTemplateNow }));
    expect(onSendTemplateNow).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: ptMessages.scheduledMessages.composer.scheduleTemplateAria })).toBeInTheDocument();
  });

  it("offers no template send to someone who may not send templates", () => {
    render(composer({ windowOpen: false }));
    expect(screen.queryByRole("button", { name: composerT.sendTemplateNow })).not.toBeInTheDocument();
  });
});

describe("emoji", () => {
  it("inserts the picked emoji at the cursor", async () => {
    render(composer());
    fireEvent.change(textarea(), { target: { value: "oi tudo" } });
    textarea().setSelectionRange(2, 2);
    fireEvent.click(screen.getByRole("button", { name: composerT.emoji.open }));
    fireEvent.click(await screen.findByText("pick-grin"));
    expect(textarea()).toHaveValue("oi😀 tudo");
  });
});

describe("localized composer copy", () => {
  it("labels the signature switch from the catalog", () => {
    render(composer());
    expect(screen.getByText(composerT.signLabel)).toBeInTheDocument();
  });
});

describe("scheduling what the composer holds", () => {
  const scheduleAria = ptMessages.scheduledMessages.composer.scheduleAria;

  it("will not schedule a placeholder the customer would receive", () => {
    render(composer({ onSchedule: vi.fn() }));
    fireEvent.change(textarea(), { target: { value: "Oi {{nome}}" } });
    expect(screen.getByRole("button", { name: scheduleAria })).toBeDisabled();
  });

  it("will not schedule several attachments, since a scheduled message carries one", async () => {
    const { container } = render(composer({ onSchedule: vi.fn() }));
    pickFiles(container, [new File(["a"], "a.png", { type: "image/png" }), new File(["b"], "b.png", { type: "image/png" })]);
    await waitFor(() => expect(screen.queryByText(composerT.attachments.uploading)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: scheduleAria })).toBeDisabled();
  });
});

describe("voice note with text", () => {
  it("sends the typed words as their own message after the voice note", async () => {
    const onSend = vi.fn();
    const onSendMedia = vi.fn();
    const { container } = render(composer({ onSend, onSendMedia }));
    pickFiles(container, [new File(["a"], "audio-message.wav", { type: "audio/wav" })]);
    await screen.findByRole("group", { name: composerT.attachments.voiceNotePreview });
    await waitFor(() => expect(screen.getByRole("button", { name: inputT.sendButton })).not.toBeDisabled());

    expect(textarea()).toHaveAttribute("placeholder", composerT.audioNoCaption);
    fireEvent.change(textarea(), { target: { value: "ouça com calma" } });
    fireEvent.click(screen.getByRole("button", { name: inputT.sendButton }));

    expect(onSendMedia).toHaveBeenCalledWith("", "media-1", "audio", false, undefined);
    expect(onSend).toHaveBeenCalledWith("ouça com calma", false, undefined);
  });
});

describe("window countdown", () => {
  it("writes the time left in the operator's language", () => {
    const inTwoHours = new Date(Date.now() + 2 * 3_600_000 + 5 * 60_000 + 30_000).toISOString();
    render(composer({ windowExpiresAt: inTwoHours }));
    expect(screen.getByText(/2 h 5 min/)).toBeInTheDocument();
  });
});

describe("voice recording", () => {
  beforeEach(() => {
    installFakeRecorder();
    toastError.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the recorded voice note to the strip once stopped", async () => {
    const microphone = grantedMicrophone();
    render(composer());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: inputT.recording }));
    });
    fireEvent.click(screen.getByRole("button", { name: composerT.recording.stop }));

    expect(await screen.findByRole("group", { name: composerT.attachments.voiceNotePreview })).toBeInTheDocument();
    expect(microphone.track.stop).toHaveBeenCalled();
    expect((mocks.upload.mock.calls[0][2] as File).type).toBe("audio/wav");
  });

  it("explains a refused microphone instead of failing silently", async () => {
    refusedMicrophone("NotAllowedError");
    render(composer());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: inputT.recording }));
    });

    expect(toastError).toHaveBeenCalledWith(ptMessages.voiceRecorder.errors.microphone_denied);
    expect(screen.queryByRole("button", { name: composerT.recording.stop })).not.toBeInTheDocument();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
});
