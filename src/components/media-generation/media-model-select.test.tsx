import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const listImageModels = vi.fn();
vi.mock("@/app/actions/image-generation", () => ({
  listImageModelsAction: () => listImageModels(),
}));

import { ImageModelSelect } from "./image-model-select";

const ranked = [
  { id: "openai/gpt-image-2.5-sunburst", name: "GPT Image 2.5 Sunburst" },
  { id: "google/gemini-3-pro-image", name: "Gemini 3 Pro Image" },
];

function renderSelect(value: string | null, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageModelSelect value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("ImageModelSelect", () => {
  beforeEach(() => {
    listImageModels.mockReset();
  });

  it("starts on the most popular image model", async () => {
    listImageModels.mockResolvedValue({ data: ranked });
    const onChange = renderSelect(null);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("openai/gpt-image-2.5-sunburst"));
    expect(screen.getByText(ptMessages.imageGeneration.modelHint)).toBeTruthy();
  });

  it("keeps a model already picked", async () => {
    listImageModels.mockResolvedValue({ data: ranked });
    const onChange = renderSelect("google/gemini-3-pro-image");
    await waitFor(() => expect(screen.getByText("Gemini 3 Pro Image")).toBeTruthy());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says so when the list cannot be loaded and picks nothing", async () => {
    listImageModels.mockResolvedValue({ error: "down", code: "models_unavailable", status: 503 });
    const onChange = renderSelect(null);
    expect(await screen.findByRole("alert")).toHaveTextContent(ptMessages.imageGeneration.modelsUnavailable);
    expect(onChange).not.toHaveBeenCalled();
  });
});
