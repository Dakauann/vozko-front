import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const fetchMediaFile = vi.fn();
const downloadBlob = vi.fn();
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: (...args: unknown[]) => fetchMediaFile(...args) }));
vi.mock("@/lib/browser/download", () => ({ downloadBlob: (...args: unknown[]) => downloadBlob(...args) }));

import { MediaDownloadButton } from "./media-download-button";

function renderButton() {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <MediaDownloadButton mediaId="m-1" description="Pizza artesanal na mesa" />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: ptMessages.imageGeneration.download }));
}

describe("MediaDownloadButton", () => {
  beforeEach(() => {
    fetchMediaFile.mockReset();
    downloadBlob.mockReset();
  });

  it("downloads the file through the API under a name taken from the description", async () => {
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    fetchMediaFile.mockResolvedValue({ data: { blob, contentType: "image/jpeg" }, error: null });
    renderButton();

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "pizza-artesanal-na-mesa.jpg"));
    expect(fetchMediaFile).toHaveBeenCalledWith("m-1");
  });

  it("says so when the download fails", async () => {
    fetchMediaFile.mockResolvedValue({ data: null, error: "Download failed with status 404" });
    renderButton();

    expect(await screen.findByRole("alert")).toHaveTextContent(ptMessages.imageGeneration.downloadFailed);
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
