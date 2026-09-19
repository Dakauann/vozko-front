import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// POST /medias reads three multipart fields and rejects the request on the
// first one missing. The picker used to send only "file", so every attempt to
// attach anything to an unofficial campaign came back with
// {"message":"Unable to get media type"} and the campaign could not be created.
const uploadMediaAction = vi.fn();
vi.mock("@/app/actions/medias", () => ({
  uploadMediaAction: (form: FormData) => uploadMediaAction(form),
}));

import { CampaignMediaPicker } from "../CampaignMediaPicker";

const labels = {
  upload: "Enviar arquivo",
  uploading: "Enviando…",
  remove: "Remover arquivo",
  failed: "Não foi possível enviar o arquivo",
};

function pick(file: File, kind = "video") {
  const onChange = vi.fn();
  render(
    <CampaignMediaPicker
      kind={kind}
      accept="video/mp4"
      labels={labels}
      onChange={onChange}
    />,
  );
  const input = screen.getByLabelText(labels.upload, { selector: "input" });
  fireEvent.change(input, { target: { files: [file] } });
  return onChange;
}

describe("CampaignMediaPicker", () => {
  beforeEach(() => {
    uploadMediaAction.mockReset();
    uploadMediaAction.mockResolvedValue({ mediaId: "media-1", mediaUrl: "u" });
  });

  it("sends every field POST /medias requires", async () => {
    const file = new File(["x"], "promo.mp4", { type: "video/mp4" });
    pick(file);

    await waitFor(() => expect(uploadMediaAction).toHaveBeenCalledTimes(1));
    const form = uploadMediaAction.mock.calls[0][0] as FormData;

    // The field NAMES are the contract; "file" is what the endpoint ignores.
    expect(form.get("media")).toBe(file);
    expect(form.get("mediaType")).toBe("video");
    expect(form.get("description")).toBe("promo.mp4");
    expect(form.get("file")).toBeNull();
  });

  // The stored type must be the message kind, not a sniffed MIME type: the send
  // path hands the provider Kind.MediaKind(), and a browser that reports an
  // empty file.type would otherwise file a video under "document".
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
});
