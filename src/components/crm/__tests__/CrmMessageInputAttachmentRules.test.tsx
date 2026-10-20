import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import CrmMessageInput from "../CrmMessageInput";
import type { ActiveConversation, EntryType } from "@/lib/conversations/types";
import ptMessages from "@/i18n/messages/pt.json";
import { crmShowing, subscribedConversation } from "@/test/composer-media-limits";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  toastError: vi.fn(),
  crm: { current: null as unknown },
  recorded: { current: null as null | ((file: File) => void) },
}));

vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: mocks.upload }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/contexts/crm-context", () => ({ useOptionalCrm: () => mocks.crm.current }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: mocks.toastError }) }));
vi.mock("@/hooks/use-voice-recorder", () => ({
  useVoiceRecorder: (onRecorded: (file: File) => void) => {
    mocks.recorded.current = onRecorded;
    return { isRecording: false, duration: 0, levels: [], error: null, start: vi.fn(), stop: vi.fn(), cancel: vi.fn() };
  },
}));

const composerT = ptMessages.whatsappCampaignsPage.detail.crm.input;
const attachmentsT = ptMessages.crmComposer.attachments;
const MB = 1024 * 1024;

function renderOpen(entryType: EntryType, conversation: ActiveConversation | null = subscribedConversation(`entry-${entryType}`, entryType)) {
  mocks.crm.current = crmShowing(conversation);
  const onSendMedia = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmMessageInput
        entryType={entryType}
        entryId={`entry-${entryType}`}
        onSend={vi.fn()}
        onSendMedia={onSendMedia}
        onTyping={vi.fn()}
        windowOpen
        windowExpiresAt={null}
        translations={composerT}
      />
    </NextIntlClientProvider>,
  );
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { input, onSendMedia };
}

function file(name: string, type: string, size: number): File {
  const made = new File(["x"], name, { type });
  Object.defineProperty(made, "size", { value: size });
  return made;
}

function pick(input: HTMLInputElement, files: File[]) {
  act(() => {
    fireEvent.change(input, { target: { files } });
  });
}

function record(made: File) {
  act(() => mocks.recorded.current?.(made));
}

beforeEach(() => {
  mocks.upload.mockReset();
  mocks.toastError.mockReset();
  mocks.upload.mockResolvedValue({ mediaId: "media-1" });
  mocks.recorded.current = null;
  window.localStorage.clear();
});

describe("composer attachment limits from the channel", () => {
  it("narrows the Mercado Livre picker to what the server listed", () => {
    expect(renderOpen("mercadolivre").input).toHaveAttribute("accept", ".jpg,.jpeg,.png,.pdf,.txt,image/jpeg,image/png,application/pdf,text/plain");
  });

  it("refuses a file type Mercado Livre does not take, without uploading it", () => {
    const { input } = renderOpen("mercadolivre");
    pick(input, [file("video.mp4", "video/mp4", 10)]);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("video.mp4 não foi anexado: este canal aceita apenas JPG, PNG, PDF, TXT.");
  });

  it("refuses a file over the size of its kind", () => {
    const { input } = renderOpen("mercadolivre");
    pick(input, [file("grande.pdf", "application/pdf", 25 * MB + 1)]);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("grande.pdf não foi anexado: o limite deste canal é 25 MB por arquivo.");
  });

  it("names kinds of any format by their kind", () => {
    const { input } = renderOpen("webchat");
    pick(input, [file("vetor.svg", "image/svg+xml", 10)]);
    expect(mocks.toastError).toHaveBeenCalledWith(
      `vetor.svg não foi anexado: este canal aceita apenas GIF, JPG, PNG, WEBP, ${attachmentsT.anyOfKind.video}, ${attachmentsT.anyOfKind.audio}, ${attachmentsT.anyOfKind.document}.`,
    );
  });

  it("uploads the allowed files of a mixed selection", () => {
    const { input } = renderOpen("mercadolivre");
    pick(input, [file("foto.jpg", "image/jpeg", 10), file("som.ogg", "audio/ogg", 10)]);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[0][2].name).toBe("foto.jpg");
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it("sends an attachment without text", async () => {
    const { input, onSendMedia } = renderOpen("mercadolivre");
    pick(input, [file("nota.pdf", "application/pdf", 10)]);
    const send = await screen.findByRole("button", { name: composerT.sendButton });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);
    expect(onSendMedia).toHaveBeenCalledWith("", "media-1", "document", false, undefined);
  });

  it("offers no voice note on Mercado Livre, which lists no audio", () => {
    renderOpen("mercadolivre");
    expect(screen.queryByRole("button", { name: composerT.recording })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: composerT.sendButton })).toBeDisabled();
  });

  it("keeps the voice note on channels that take audio", () => {
    renderOpen("whatsapp");
    expect(screen.getByRole("button", { name: composerT.recording })).toBeInTheDocument();
  });
});

describe("composer before the channel limits are known", () => {
  it("disables the clip, hides the voice note and refuses a pasted file", () => {
    const { input } = renderOpen("whatsapp", subscribedConversation("entry-whatsapp", "whatsapp", "unknown"));
    expect(screen.getByRole("button", { name: composerT.attachFile })).toBeDisabled();
    expect(screen.queryByRole("button", { name: composerT.recording })).not.toBeInTheDocument();
    pick(input, [file("foto.jpg", "image/jpeg", 10)]);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(attachmentsT.channelLimitsUnknown.replace("{name}", "foto.jpg"));
  });

  it("treats a composer outside any open conversation as unknown", () => {
    const { input } = renderOpen("telegram", null);
    pick(input, [file("foto.jpg", "image/jpeg", 10)]);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("refuses every file on a channel that takes no attachments", () => {
    const { input } = renderOpen("webchat", subscribedConversation("entry-webchat", "webchat", []));
    expect(screen.getByRole("button", { name: composerT.attachFile })).toBeDisabled();
    pick(input, [file("foto.jpg", "image/jpeg", 10)]);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(attachmentsT.channelTakesNone.replace("{name}", "foto.jpg"));
  });
});

describe("recorded voice notes against the channel limits", () => {
  it("sends a long voice note on WhatsApp, which the server converts before its own limit", () => {
    renderOpen("whatsapp");
    record(file("audio-message.wav", "audio/wav", 30 * MB));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("refuses a recording in a format the channel does not list", () => {
    renderOpen("instagram");
    record(file("audio-message.webm", "audio/webm;codecs=opus", 10));
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it("sends the usual WAV recording on Instagram", () => {
    renderOpen("instagram");
    record(file("audio-message.wav", "audio/wav", 2 * MB));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
