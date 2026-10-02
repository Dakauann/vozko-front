import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ImageGenerationJob } from "@/lib/image-generation/types";

const requestImageGeneration = vi.fn();
const getImageGeneration = vi.fn();
vi.mock("@/app/actions/image-generation", () => ({
  requestImageGenerationAction: (...args: unknown[]) => requestImageGeneration(...args),
  getImageGenerationAction: (...args: unknown[]) => getImageGeneration(...args),
}));

const uploadMedia = vi.fn();
vi.mock("@/app/actions/medias", () => ({
  uploadMediaAction: (...args: unknown[]) => uploadMedia(...args),
  fetchMediaFileAction: vi.fn(),
}));

import { MediaPicker } from "./media-picker";

function job(overrides: Partial<ImageGenerationJob>): ImageGenerationJob {
  return {
    id: "job-1",
    status: "queued",
    prompt: "uma bicicleta vermelha",
    aspect: "square",
    referenceMediaIds: [],
    createdAt: "2026-10-02T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
    ...overrides,
  };
}

function openGenerator(onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <MediaPicker value={null} accept="image" canGenerate onChange={onChange} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText(ptMessages.adsWizard.media.modeGenerate));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "uma bicicleta vermelha" } });
  return onChange;
}

function renderPicker(onChange = vi.fn()) {
  openGenerator(onChange);
  fireEvent.click(screen.getByText(ptMessages.adsWizard.media.generate));
  return onChange;
}

function referenceInput(): HTMLInputElement {
  return screen.getByLabelText(ptMessages.adsWizard.media.addReference, { selector: "input" });
}

function addReference(name: string) {
  fireEvent.change(referenceInput(), { target: { files: [new File(["x"], name, { type: "image/png" })] } });
}

describe("MediaPicker generation", () => {
  beforeEach(() => {
    requestImageGeneration.mockReset();
    getImageGeneration.mockReset();
    uploadMedia.mockReset();
  });

  it("hands the generated image to the ad", async () => {
    requestImageGeneration.mockResolvedValue({ data: job({ status: "done", mediaId: "m1", mediaUrl: "https://cdn/m1.png" }) });
    const onChange = renderPicker();

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ kind: "image", mediaId: "m1", url: "https://cdn/m1.png" }));
    expect(requestImageGeneration).toHaveBeenCalledWith("uma bicicleta vermelha", "square", []);
  });

  it("shows the preview with an estimated percentage and locks the prompt while the job runs", async () => {
    requestImageGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generatingTitle)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: ptMessages.imageGeneration.generating })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("sends the reference images the user added, and only those still kept", async () => {
    uploadMedia
      .mockResolvedValueOnce({ mediaId: "ref-1", mediaUrl: "https://cdn/ref-1.png" })
      .mockResolvedValueOnce({ mediaId: "ref-2", mediaUrl: "https://cdn/ref-2.png" });
    requestImageGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    openGenerator();

    addReference("a.png");
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/ref-1.png"]')).toBeTruthy());
    addReference("b.png");
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/ref-2.png"]')).toBeTruthy());
    expect(uploadMedia.mock.calls[0][0].get("mediaType")).toBe("image");

    fireEvent.click(screen.getAllByRole("button", { name: ptMessages.adsWizard.media.removeReference })[0]);
    expect(document.querySelector('img[src="https://cdn/ref-1.png"]')).toBeNull();

    fireEvent.click(screen.getByText(ptMessages.adsWizard.media.generate));
    await waitFor(() => expect(requestImageGeneration).toHaveBeenCalledWith("uma bicicleta vermelha", "square", ["ref-2"]));
  });

  it("explains a reference that is no longer usable", async () => {
    requestImageGeneration.mockResolvedValue({ data: job({ status: "failed", failureCode: "reference_unavailable" }) });
    renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.reference_unavailable)).toBeInTheDocument();
  });

  it("explains a failure that was charged but not saved", async () => {
    requestImageGeneration.mockResolvedValue({ data: job({ status: "failed", failureCode: "storage_failed" }) });
    renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.storage_failed)).toBeInTheDocument();
  });

  it("explains a refused request by its code", async () => {
    requestImageGeneration.mockResolvedValue({ error: "insufficient balance", code: "insufficient_balance", status: 402 });
    renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.insufficient_balance)).toBeInTheDocument();
  });

  it("falls back to a generic message for codes it does not know", async () => {
    requestImageGeneration.mockResolvedValue({ error: "prompt is required", code: "validation_failed", status: 422 });
    renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.unknown)).toBeInTheDocument();
  });
});

describe("MediaPicker chosen image", () => {
  it("offers a download of the chosen image", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <MediaPicker value={{ kind: "image", mediaId: "m1", url: "https://cdn/m1.png" }} accept="image" canGenerate onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: ptMessages.imageGeneration.download })).toBeInTheDocument();
  });
});
