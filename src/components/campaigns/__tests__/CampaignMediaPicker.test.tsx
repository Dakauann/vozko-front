import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import {
  FakeMediaRecorder,
  grantedMicrophone,
  installFakeRecorder,
  refusedMicrophone,
} from "@/test/fake-media-recorder";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

const uploadMediaAction = vi.fn();
vi.mock("@/app/actions/medias", () => ({
  uploadMediaAction: (form: FormData) => uploadMediaAction(form),
}));

import { CampaignMediaPicker, MEDIA_ACCEPT } from "../CampaignMediaPicker";

const labels = {
  upload: "Enviar arquivo",
  uploading: "Enviando…",
  remove: "Remover arquivo",
  failed: "Não foi possível enviar o arquivo",
};

const recorderT = ptMessages.voiceRecorder;

function renderPicker(kind: string, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CampaignMediaPicker kind={kind} accept={MEDIA_ACCEPT[kind] ?? "*/*"} labels={labels} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

function pick(file: File, kind = "video") {
  const onChange = renderPicker(kind);
  const input = screen.getByLabelText(labels.upload, { selector: "input" });
  fireEvent.change(input, { target: { files: [file] } });
  return onChange;
}

async function recordTake() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: recorderT.record }));
  });
  fireEvent.click(screen.getByRole("button", { name: recorderT.stop }));
  return screen.findByRole("group", { name: recorderT.preview });
}

describe("CampaignMediaPicker", () => {
  beforeEach(() => {
    uploadMediaAction.mockReset();
    uploadMediaAction.mockResolvedValue({ mediaId: "media-1", mediaUrl: "u" });
    URL.createObjectURL = vi.fn(() => "blob:take");
    URL.revokeObjectURL = vi.fn();
    installFakeRecorder();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends every field POST /medias requires", async () => {
    const file = new File(["x"], "promo.mp4", { type: "video/mp4" });
    pick(file);

    await waitFor(() => expect(uploadMediaAction).toHaveBeenCalledTimes(1));
    const form = uploadMediaAction.mock.calls[0][0] as FormData;

    expect(form.get("media")).toBe(file);
    expect(form.get("mediaType")).toBe("video");
    expect(form.get("description")).toBe("promo.mp4");
    expect(form.get("file")).toBeNull();
  });

  it("stores the file under the campaign's own message kind", async () => {
    const file = new File(["x"], "sem-tipo", { type: "" });
    pick(file, "audio");

    await waitFor(() => expect(uploadMediaAction).toHaveBeenCalledTimes(1));
    const form = uploadMediaAction.mock.calls[0][0] as FormData;
    expect(form.get("mediaType")).toBe("audio");
  });

  it("surfaces the server's own message instead of swallowing it", async () => {
    uploadMediaAction.mockResolvedValue({
      mediaId: null,
      mediaUrl: null,
      error: "Unable to get media type",
    });
    const onChange = pick(new File(["x"], "promo.mp4", { type: "video/mp4" }));

    expect(await screen.findByText("Unable to get media type")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hands back the media id the campaign will carry", async () => {
    uploadMediaAction.mockResolvedValue({
      mediaId: "media-9",
      mediaUrl: "https://cdn/x.mp4",
      mediaPreviewUrl: null,
    });
    const onChange = pick(new File(["x"], "promo.mp4", { type: "video/mp4" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toMatchObject({
      mediaId: "media-9",
      fileName: "promo.mp4",
    });
  });

  it("offers the videos WhatsApp plays and nothing it cannot", () => {
    expect(MEDIA_ACCEPT.video.split(",")).toEqual(["video/mp4", "video/3gpp", ".mp4", ".3gp"]);
  });

  it("offers a voice recording only for an audio message", () => {
    renderPicker("image");
    expect(screen.queryByRole("button", { name: recorderT.record })).not.toBeInTheDocument();
  });

  it("lets the user listen to a recording, then attaches it like an uploaded audio", async () => {
    grantedMicrophone();
    uploadMediaAction.mockResolvedValue({ mediaId: "media-voice", mediaUrl: "https://cdn/v.wav" });
    const onChange = renderPicker("audio");

    expect(await recordTake()).toBeInTheDocument();
    expect(uploadMediaAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: recorderT.use }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const form = uploadMediaAction.mock.calls[0][0] as FormData;
    const media = form.get("media") as File;
    expect(media.type).toBe("audio/wav");
    expect(form.get("mediaType")).toBe("audio");
    expect(form.get("description")).toBe(media.name);
    expect(onChange.mock.calls[0][0]).toMatchObject({ mediaId: "media-voice", fileName: media.name });
  });

  it("records again in place of a take the user did not like", async () => {
    const microphone = grantedMicrophone();
    renderPicker("audio");
    await recordTake();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: recorderT.rerecord }));
    });

    expect(microphone.getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("group", { name: recorderT.preview })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: recorderT.stop })).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:take");
  });

  it("throws a take away without uploading it", async () => {
    grantedMicrophone();
    const onChange = renderPicker("audio");
    await recordTake();

    fireEvent.click(screen.getByRole("button", { name: recorderT.discard }));

    expect(screen.queryByRole("group", { name: recorderT.preview })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: recorderT.record })).toBeInTheDocument();
    expect(uploadMediaAction).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cancels a recording in progress and frees the microphone", async () => {
    const microphone = grantedMicrophone();
    renderPicker("audio");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: recorderT.record }));
    });

    fireEvent.click(screen.getByRole("button", { name: recorderT.cancel }));

    expect(microphone.track.stop).toHaveBeenCalled();
    expect(FakeMediaRecorder.instances[0].state).toBe("inactive");
    expect(screen.getByRole("button", { name: recorderT.record })).toBeInTheDocument();
  });

  it("explains a refused microphone in the user's language and records nothing", async () => {
    refusedMicrophone("NotAllowedError");
    renderPicker("audio");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: recorderT.record }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(recorderT.errors.microphone_denied);
    expect(screen.queryByRole("button", { name: recorderT.stop })).not.toBeInTheDocument();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it("explains a missing microphone", async () => {
    refusedMicrophone("NotFoundError");
    renderPicker("audio");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: recorderT.record }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(recorderT.errors.microphone_not_found);
  });
});
