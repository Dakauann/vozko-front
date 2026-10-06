import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ModelKind } from "@/lib/media-generation/types";

const listMediaModels = vi.fn();
vi.mock("@/app/actions/media-generation", () => ({
  listMediaModelsAction: (kind: ModelKind) => listMediaModels(kind),
}));

import { MediaModelSelect } from "./media-model-select";

const ranked = [
  { id: "openai/gpt-image-2.5-sunburst", name: "GPT Image 2.5 Sunburst", default: true },
  { id: "google/gemini-3-pro-image", name: "Gemini 3 Pro Image", default: false },
];

const music = [
  { id: "acme/tune-1", name: "Tune 1", default: false },
  { id: "google/lyria-3-clip-preview", name: "Lyria 3 Clip", default: true },
];

function renderSelect(value: string | null, { kind = "image", preferred }: { kind?: ModelKind; preferred?: string } = {}) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <MediaModelSelect kind={kind} value={value} onChange={onChange} preferred={preferred} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("MediaModelSelect", () => {
  beforeEach(() => {
    listMediaModels.mockReset();
  });

  it("starts on the recommended image model", async () => {
    listMediaModels.mockResolvedValue({ data: ranked });
    const onChange = renderSelect(null);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("openai/gpt-image-2.5-sunburst"));
    expect(listMediaModels).toHaveBeenCalledWith("image");
    expect(screen.getByText(ptMessages.mediaGeneration.modelHint)).toBeTruthy();
  });

  it("asks the catalog of the kind and starts on the model the card recommends", async () => {
    listMediaModels.mockResolvedValue({ data: music });
    const onChange = renderSelect(null, { kind: "music", preferred: "acme/tune-1" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("acme/tune-1"));
    expect(listMediaModels).toHaveBeenCalledWith("music");
  });

  it("keeps a model already picked", async () => {
    listMediaModels.mockResolvedValue({ data: ranked });
    const onChange = renderSelect("google/gemini-3-pro-image");
    await waitFor(() => expect(screen.getByText("Gemini 3 Pro Image")).toBeTruthy());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says so when the list cannot be loaded and picks nothing", async () => {
    listMediaModels.mockResolvedValue({ error: "down", code: "models_unavailable", status: 503 });
    const onChange = renderSelect(null, { kind: "voice" });
    expect(await screen.findByRole("alert")).toHaveTextContent(ptMessages.mediaGeneration.modelsUnavailable.voice);
    expect(onChange).not.toHaveBeenCalled();
  });
});
