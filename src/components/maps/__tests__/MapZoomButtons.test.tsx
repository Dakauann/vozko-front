import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { LeadMapContext } from "../map-context";
import { MapZoomButtons } from "../MapZoomButtons";
import { renderInPortuguese } from "./intl";

describe("MapZoomButtons", () => {
  it("zooms the map in and out from labelled buttons", () => {
    const map = { zoomIn: vi.fn(), zoomOut: vi.fn() };
    renderInPortuguese(
      <LeadMapContext.Provider value={{ map: map as unknown as MapLibreMap, palette: null, setDrawing: vi.fn() }}>
        <MapZoomButtons />
      </LeadMapContext.Provider>,
    );
    const group = screen.getByRole("group", { name: "Zoom" });
    fireEvent.click(within(group).getByRole("button", { name: "Aproximar" }));
    fireEvent.click(within(group).getByRole("button", { name: "Afastar" }));
    expect(map.zoomIn).toHaveBeenCalledTimes(1);
    expect(map.zoomOut).toHaveBeenCalledTimes(1);
  });

  it("stays disabled until the map exists", () => {
    renderInPortuguese(
      <LeadMapContext.Provider value={{ map: null, palette: null, setDrawing: vi.fn() }}>
        <MapZoomButtons />
      </LeadMapContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Aproximar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Afastar" })).toBeDisabled();
  });
});
