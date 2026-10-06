import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { MediaGenerationJob } from "@/lib/media-generation/types";

const requestMediaGeneration = vi.fn();
const getMediaGeneration = vi.fn();
const listMediaModels = vi.fn();
vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: (...args: unknown[]) => requestMediaGeneration(...args),
  getMediaGenerationAction: (...args: unknown[]) => getMediaGeneration(...args),
  listMediaModelsAction: (kind: string) => listMediaModels(kind),
}));

const MOST_POPULAR = "openai/gpt-image-2.5-sunburst";

const uploadMedia = vi.fn();
const listLibrary = vi.fn();
vi.mock("@/app/actions/medias", () => ({
  uploadMediaAction: (...args: unknown[]) => uploadMedia(...args),
  listLibraryAction: () => listLibrary(),
  fetchMediaFileAction: vi.fn(),
}));

import { MediaPicker } from "./media-picker";

function job(overrides: Partial<MediaGenerationJob>): MediaGenerationJob {
  return {
    id: "job-1",
    kind: "image",
    status: "queued",
    prompt: "uma bicicleta vermelha",
    aspect: "square",
    referenceMediaIds: [],
    createdAt: "2026-10-02T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
    ...overrides,
  };
}

async function openGenerator(onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <MediaPicker value={null} accept="image" canGenerate onChange={onChange} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText(ptMessages.adsWizard.media.modeGenerate));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "uma bicicleta vermelha" } });
  await screen.findByText(/GPT Image 2.5 Sunburst/);
  return onChange;
}

async function renderPicker(onChange = vi.fn()) {
  await openGenerator(onChange);
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
    requestMediaGeneration.mockReset();
    getMediaGeneration.mockReset();
    uploadMedia.mockReset();
    listMediaModels.mockReset();
    listMediaModels.mockResolvedValue({
      data: [
        { id: MOST_POPULAR, name: "GPT Image 2.5 Sunburst", default: true },
        { id: "google/gemini-3-pro-image", name: "Gemini 3 Pro Image", default: false },
      ],
    });
  });

  it("hands the generated image to the ad", async () => {
    requestMediaGeneration.mockResolvedValue({ data: job({ status: "done", mediaId: "m1", mediaUrl: "https://cdn/m1.png" }) });
    const onChange = await renderPicker();

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ kind: "image", mediaId: "m1", url: "https://cdn/m1.png" }));
    expect(requestMediaGeneration).toHaveBeenCalledWith({ kind: "image", model: MOST_POPULAR, prompt: "uma bicicleta vermelha", aspect: "square", referenceMediaIds: [] });
  });

  it("shows the preview with an estimated percentage and locks the prompt while the job runs", async () => {
    requestMediaGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    await renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generatingTitle)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: ptMessages.mediaGeneration.generating.image })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("sends the reference images the user added, and only those still kept", async () => {
    uploadMedia
      .mockResolvedValueOnce({ mediaId: "ref-1", mediaUrl: "https://cdn/ref-1.png" })
      .mockResolvedValueOnce({ mediaId: "ref-2", mediaUrl: "https://cdn/ref-2.png" });
    requestMediaGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    await openGenerator();

    addReference("a.png");
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/ref-1.png"]')).toBeTruthy());
    addReference("b.png");
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/ref-2.png"]')).toBeTruthy());
    expect(uploadMedia.mock.calls[0][0].get("mediaType")).toBe("image");

    fireEvent.click(screen.getAllByRole("button", { name: ptMessages.adsWizard.media.removeReference })[0]);
    expect(document.querySelector('img[src="https://cdn/ref-1.png"]')).toBeNull();

    fireEvent.click(screen.getByText(ptMessages.adsWizard.media.generate));
    await waitFor(() => expect(requestMediaGeneration).toHaveBeenCalledWith({ kind: "image", model: MOST_POPULAR, prompt: "uma bicicleta vermelha", aspect: "square", referenceMediaIds: ["ref-2"] }));
  });

  it("explains a reference that is no longer usable", async () => {
    requestMediaGeneration.mockResolvedValue({ data: job({ status: "failed", failureCode: "reference_unavailable" }) });
    await renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.reference_unavailable)).toBeInTheDocument();
  });

  it("explains a failure that was charged but not saved", async () => {
    requestMediaGeneration.mockResolvedValue({ data: job({ status: "failed", failureCode: "storage_failed" }) });
    await renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.storage_failed)).toBeInTheDocument();
  });

  it("explains a refused request by its code", async () => {
    requestMediaGeneration.mockResolvedValue({ error: "insufficient balance", code: "insufficient_balance", status: 402 });
    await renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.insufficient_balance)).toBeInTheDocument();
  });

  it("falls back to a generic message for codes it does not know", async () => {
    requestMediaGeneration.mockResolvedValue({ error: "prompt is required", code: "validation_failed", status: 422 });
    await renderPicker();

    expect(await screen.findByText(ptMessages.adsWizard.media.generationErrors.unknown)).toBeInTheDocument();
  });

  it("cannot generate without the image model list", async () => {
    listMediaModels.mockResolvedValue({ error: "down", code: "models_unavailable", status: 503 });
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <MediaPicker value={null} accept="image" canGenerate onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByText(ptMessages.adsWizard.media.modeGenerate));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "uma bicicleta vermelha" } });
    expect(await screen.findByText(ptMessages.mediaGeneration.modelsUnavailable.image)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptMessages.adsWizard.media.generate })).toBeDisabled();
    expect(requestMediaGeneration).not.toHaveBeenCalled();
  });
});

describe("MediaPicker chosen image", () => {
  it("offers a download of the chosen image", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <MediaPicker value={{ kind: "image", mediaId: "m1", url: "https://cdn/m1.png" }} accept="image" canGenerate onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: ptMessages.mediaGeneration.download })).toBeInTheDocument();
  });

});

describe("MediaPicker library", () => {
  const library = [
    { id: "img-1", description: "banner", url: "https://cdn.example.com/banner.jpg", previewUrl: "", createdAt: "2026-10-05T10:00:00Z", type: "image" },
    { id: "vid-1", description: "video com som", url: "https://cdn.example.com/spot.mp4", previewUrl: "", createdAt: "2026-10-05T10:00:00Z", type: "video" },
    { id: "aud-1", description: "trilha", url: "https://cdn.example.com/trilha.m4a", previewUrl: "", createdAt: "2026-10-05T10:00:00Z", type: "audio" },
  ];

  function openLibrary(accept: "image" | "video" | "any", onChange = vi.fn()) {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <MediaPicker value={null} accept={accept} canGenerate onChange={onChange} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByText(ptMessages.adsWizard.media.modeLibrary));
    return onChange;
  }

  beforeEach(() => {
    listLibrary.mockReset();
  });

  it("lists the videos of the library, generated ones included, and picks one", async () => {
    listLibrary.mockResolvedValue({ data: library });
    const onChange = openLibrary("video");
    const picks = await screen.findAllByRole("button", { name: ptMessages.adsWizard.media.library.pickVideo });
    expect(picks).toHaveLength(1);
    expect(screen.queryByRole("button", { name: ptMessages.adsWizard.media.library.pickImage })).toBeNull();
    fireEvent.click(picks[0]);
    expect(onChange).toHaveBeenCalledWith({ kind: "video", mediaId: "vid-1", url: "https://cdn.example.com/spot.mp4" });
  });

  it("says so when the library has nothing that fits", async () => {
    listLibrary.mockResolvedValue({ data: [library[2]] });
    openLibrary("any");
    expect(await screen.findByText(ptMessages.adsWizard.media.library.empty.any)).toBeInTheDocument();
  });

  it("shows an error, never an empty library, when the list cannot be loaded, and retries", async () => {
    listLibrary.mockResolvedValueOnce({ error: "down", status: 500 }).mockResolvedValueOnce({ data: library });
    openLibrary("image");
    expect(await screen.findByRole("alert")).toHaveTextContent(ptMessages.adsWizard.media.library.failed);
    expect(screen.queryByText(ptMessages.adsWizard.media.library.empty.image)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: ptMessages.adsWizard.media.library.retry }));
    expect(await screen.findByRole("button", { name: ptMessages.adsWizard.media.library.pickImage })).toBeInTheDocument();
  });
});
