import { describe, expect, it } from "vitest";

import { mediaDownloadName } from "./download-name";

describe("mediaDownloadName", () => {
  it("slugs the description and keeps the real extension", () => {
    expect(mediaDownloadName("Pizza artesanal na mesa de madeira, luz natural!", "image/jpeg")).toBe(
      "pizza-artesanal-na-mesa-de-madeira-luz-natural.jpg",
    );
    expect(mediaDownloadName("Promoção de Inverno", "image/png")).toBe("promocao-de-inverno.png");
    expect(mediaDownloadName("Card", "image/webp; charset=binary")).toBe("card.webp");
  });

  it("keeps long prompts short without a trailing dash", () => {
    const name = mediaDownloadName(`${"palavra ".repeat(30)}fim`, "image/jpeg");
    expect(name.length).toBeLessThanOrEqual(64);
    expect(name).toMatch(/^[a-z0-9-]+[a-z0-9]\.jpg$/);
  });

  it("falls back to a neutral name and no invented extension", () => {
    expect(mediaDownloadName("   ", "image/jpeg")).toBe("imagem.jpg");
    expect(mediaDownloadName("relatório", "application/octet-stream")).toBe("relatorio");
  });
});
