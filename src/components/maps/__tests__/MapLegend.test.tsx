import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { APPROXIMATE_TOKEN, cssTokenColor, DISTRICT_FILL_ALPHA, HEAT_TOKEN, mapPalette } from "@/lib/maps/palette";

import { LeadMapContext } from "../map-context";
import { MapLegend } from "../MapLegend";
import { renderInPortuguese } from "./intl";

const TOKENS: Record<string, string> = {
  "--card": "0 0% 100%",
  "--foreground": "206 15% 9%",
  "--muted-foreground": "206 9% 38%",
  "--border-strong": "205 12% 76%",
  "--primary": "164 100% 38%",
  "--primary-edge": "164 100% 30%",
  "--chart-2": "231 60% 56%",
  "--chart-3": "43 92% 45%",
  "--chart-4": "199 89% 42%",
  "--chart-5": "321 50% 46%",
  "--warning-ink": "32 94% 29%",
};

const palette = mapPalette((name) => TOKENS[name] ?? "", "light");

function withPalette(children: ReactNode) {
  return <LeadMapContext.Provider value={{ map: null, palette, setDrawing: vi.fn() }}>{children}</LeadMapContext.Provider>;
}

describe("MapLegend", () => {
  it("reads Calor as a ramp from Menos to Mais in the theme's heat colours, with the artifact note", () => {
    const { container } = renderInPortuguese(withPalette(<MapLegend mode="heat" />));
    expect(screen.getByText("Menos")).toBeInTheDocument();
    expect(screen.getByText("Mais")).toBeInTheDocument();
    const ramp = container.querySelector("[data-heat-ramp]") as HTMLElement;
    const reference = document.createElement("span");
    reference.style.background = "linear-gradient(90deg, hsla(231, 60%, 76%, 0.35), hsla(231, 60%, 32%, 0.85))";
    expect(ramp.style.background).toBe(reference.style.background);
    expect(screen.getByText("Calor só com leads que têm posição de casa; aproximados entram na visão Por bairro.")).toBeInTheDocument();
    expect(screen.queryByText("Aproximado (CEP, bairro ou cidade)")).not.toBeInTheDocument();
  });

  it("draws no ramp before the theme is read, rather than a wrong colour", () => {
    const { container } = renderInPortuguese(<MapLegend mode="heat" />);
    expect(container.querySelector("[data-heat-ramp]")).toBeNull();
    expect(screen.getByText("Menos")).toBeInTheDocument();
  });

  it("explains the solid chart-2 dot in Pontos when no field colours the map", () => {
    const { container } = renderInPortuguese(withPalette(<MapLegend mode="points" />));
    expect(screen.getByText("Posição de casa")).toBeInTheDocument();
    expect((container.querySelector("[data-precise-swatch]") as HTMLElement).style.backgroundColor).toBe(cssTokenColor(HEAT_TOKEN));
  });

  it("leaves the colour values to the panel when a field colours the map", () => {
    renderInPortuguese(withPalette(<MapLegend mode="points" coloured />));
    expect(screen.queryByText("Posição de casa")).not.toBeInTheDocument();
  });

  it("explains the approximate rings in warning ink with their count, in Pontos only", () => {
    const { container } = renderInPortuguese(withPalette(<MapLegend mode="points" approximateCount={1347} />));
    expect(screen.getByText("Aproximado (CEP, bairro ou cidade)")).toBeInTheDocument();
    expect(screen.getByText("1.347")).toBeInTheDocument();
    const swatch = container.querySelector("[data-approximate-swatch]") as HTMLElement;
    expect(swatch.style.borderColor).toBe(cssTokenColor(APPROXIMATE_TOKEN));
    expect(swatch.style.backgroundColor).toBe("");
  });

  it("leaves the approximate row out when no approximate lead is drawn", () => {
    renderInPortuguese(withPalette(<MapLegend mode="points" approximateCount={0} />));
    expect(screen.queryByText("Aproximado (CEP, bairro ou cidade)")).not.toBeInTheDocument();
  });

  it("explains the bairro circles with their count in Por bairro", () => {
    const { container } = renderInPortuguese(withPalette(<MapLegend mode="districts" districtsCount={312} />));
    expect(screen.getByText("Por bairro")).toBeInTheDocument();
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText(/aproximados incluídos/)).toBeInTheDocument();
    const district = container.querySelector("[data-district-swatch]") as HTMLElement;
    expect(district.style.backgroundColor).toBe(cssTokenColor(HEAT_TOKEN, DISTRICT_FILL_ALPHA));
    expect(screen.queryByText("Menos")).not.toBeInTheDocument();
  });

  it("shows the selection and the drawn area", () => {
    renderInPortuguese(withPalette(<MapLegend mode="heat" selectedCount={4} showArea />));
    expect(screen.getByText("Selecionados")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Área desenhada")).toBeInTheDocument();
  });

  it("credits the reference data and names itself as the legend", () => {
    renderInPortuguese(withPalette(<MapLegend mode="points" credit="Fonte: IBGE, CNEFE 2022" />));
    expect(screen.getByText("Fonte: IBGE, CNEFE 2022")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Legenda do mapa" })).toBeInTheDocument();
  });
});
