import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

import type { MapPalette } from "@/lib/maps/palette";

import { AreaDrawControl } from "../AreaDrawControl";
import { LeadMapContext } from "../map-context";
import { renderInPortuguese } from "./intl";

type Listener = (id: string) => void;

const terra = vi.hoisted(() => {
  const state = {
    instances: [] as Array<{
      options: { modes: Array<{ name: string; options: Record<string, unknown> }> };
      listeners: Record<string, (id: string) => void>;
      mode: string;
      cleared: number;
      stopped: boolean;
      snapshot: Record<string, unknown>;
      styles: Record<string, unknown>;
    }>,
  };
  return state;
});

vi.mock("terra-draw", () => {
  const mode = (name: string) =>
    class {
      name = name;
      constructor(public options: Record<string, unknown>) {}
    };
  class TerraDraw {
    listeners: Record<string, Listener> = {};
    mode = "static";
    cleared = 0;
    stopped = false;
    enabled = false;
    snapshot: Record<string, unknown> = {};
    styles: Record<string, unknown> = {};
    constructor(public options: { modes: Array<{ name: string; options: Record<string, unknown> }> }) {
      terra.instances.push(this);
    }
    start() {
      this.enabled = true;
    }
    stop() {
      this.enabled = false;
      this.stopped = true;
    }
    on(event: string, listener: Listener) {
      this.listeners[event] = listener;
    }
    getMode() {
      return this.mode;
    }
    setMode(mode: string) {
      this.mode = mode;
    }
    clear() {
      this.cleared += 1;
    }
    getSnapshotFeature(id: string) {
      return this.snapshot[id];
    }
    setModeStyles(mode: string, styles: unknown) {
      this.styles[mode] = styles;
    }
  }
  return {
    TerraDraw,
    TerraDrawPolygonMode: mode("polygon"),
    TerraDrawRectangleMode: mode("rectangle"),
    TerraDrawCircleMode: mode("circle"),
    ValidateNotSelfIntersecting: vi.fn(() => ({ valid: false, reason: "Feature intersects itself" })),
  };
});

vi.mock("terra-draw-maplibre-gl-adapter", () => ({
  TerraDrawMapLibreGLAdapter: class {
    constructor(public config: unknown) {}
  },
}));

const palette = {
  primaryHex: "#00c28e",
  surfaceHex: "#ffffff",
} as unknown as MapPalette;

const mapContainer = document.createElement("div");
const map = { getContainer: () => mapContainer } as unknown as MapLibreMap;
const setDrawing = vi.fn();

function renderControl(onAreaDrawn = vi.fn()) {
  renderInPortuguese(
    <LeadMapContext.Provider value={{ map, palette, setDrawing }}>
      <AreaDrawControl onAreaDrawn={onAreaDrawn} />
    </LeadMapContext.Provider>,
  );
  return onAreaDrawn;
}

async function readyDraw() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Polígono" })).toBeEnabled());
  return terra.instances[terra.instances.length - 1];
}

const square = {
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[[-46.7, -23.6], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -23.5], [-46.7, -23.6]]],
  },
  properties: { mode: "polygon" },
};

describe("AreaDrawControl", () => {
  beforeEach(() => {
    terra.instances.length = 0;
    setDrawing.mockReset();
  });

  it("starts terra-draw with the polygon, rectangle and circle modes in the primary colour", async () => {
    renderControl();
    const draw = await readyDraw();
    expect(draw.options.modes.map((mode) => mode.name)).toEqual(["polygon", "rectangle", "circle"]);
    for (const mode of draw.options.modes) {
      expect(mode.options.styles).toMatchObject({ outlineColor: "#00c28e", fillColor: "#00c28e" });
    }
  });

  it("only checks self-crossing once a vertex is committed", async () => {
    renderControl();
    const draw = await readyDraw();
    const validation = draw.options.modes[0].options.validation as (feature: unknown, context: { updateType: string }) => { valid: boolean };
    expect(validation(square, { updateType: "provisional" })).toEqual({ valid: true });
    expect(validation(square, { updateType: "finish" }).valid).toBe(false);
  });

  it("switches terra-draw to the chosen mode", async () => {
    renderControl();
    const draw = await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Retângulo" }));
    expect(draw.mode).toBe("rectangle");
    expect(screen.getByRole("button", { name: "Retângulo" })).toHaveAttribute("aria-pressed", "true");
  });

  it("emits the drawn area, clears the sketch and returns to idle", async () => {
    const onAreaDrawn = renderControl();
    const draw = await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Polígono" }));
    draw.snapshot["f1"] = square;
    act(() => draw.listeners.finish("f1"));
    expect(onAreaDrawn).toHaveBeenCalledWith({
      kind: "polygon",
      ring: [
        { lat: -23.6, lng: -46.7 },
        { lat: -23.6, lng: -46.6 },
        { lat: -23.5, lng: -46.6 },
        { lat: -23.5, lng: -46.7 },
      ],
    });
    expect(draw.mode).toBe("static");
    expect(draw.cleared).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Polígono" })).toHaveAttribute("aria-pressed", "false");
  });

  it("refuses a drawing it cannot turn into an area and says so", async () => {
    const onAreaDrawn = renderControl();
    const draw = await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Polígono" }));
    draw.snapshot["f2"] = { ...square, properties: { mode: "freehand" } };
    act(() => draw.listeners.finish("f2"));
    expect(onAreaDrawn).not.toHaveBeenCalled();
    expect(screen.getByText(/Não foi possível usar esta área/)).toBeInTheDocument();
  });

  it("cancels the drawing with Escape on the map", async () => {
    renderControl();
    const draw = await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Raio" }));
    fireEvent.keyDown(mapContainer, { key: "Escape" });
    expect(draw.mode).toBe("static");
    expect(screen.getByRole("button", { name: "Raio" })).toHaveAttribute("aria-pressed", "false");
    expect(setDrawing).toHaveBeenLastCalledWith(false);
  });

  it("leaves the drawing alone when Escape closes something else on the page", async () => {
    renderControl();
    const draw = await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Raio" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(draw.mode).toBe("circle");
    expect(screen.getByRole("button", { name: "Raio" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores an Escape another handler already used", async () => {
    renderControl();
    const draw = await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Raio" }));
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    escape.preventDefault();
    act(() => {
      mapContainer.dispatchEvent(escape);
    });
    expect(draw.mode).toBe("circle");
  });

  it("tells the map it is drawing while a mode is active, so map clicks do not open dots", async () => {
    renderControl();
    await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Polígono" }));
    expect(setDrawing).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar desenho" }));
    expect(setDrawing).toHaveBeenLastCalledWith(false);
  });

  it("keeps the map in drawing mode until the click that closed the shape has passed", async () => {
    vi.useFakeTimers();
    try {
      renderControl();
      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Polígono" })).toBeEnabled());
      const draw = terra.instances[terra.instances.length - 1];
      fireEvent.click(screen.getByRole("button", { name: "Polígono" }));
      draw.snapshot["f3"] = square;
      act(() => draw.listeners.finish("f3"));
      expect(setDrawing).toHaveBeenLastCalledWith(true);
      act(() => {
        vi.runAllTimers();
      });
      expect(setDrawing).toHaveBeenLastCalledWith(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops marking the map as drawing when it unmounts mid-drawing", async () => {
    const { unmount } = renderInPortuguese(
      <LeadMapContext.Provider value={{ map, palette, setDrawing }}>
        <AreaDrawControl onAreaDrawn={vi.fn()} />
      </LeadMapContext.Provider>,
    );
    await readyDraw();
    fireEvent.click(screen.getByRole("button", { name: "Retângulo" }));
    unmount();
    expect(setDrawing).toHaveBeenLastCalledWith(false);
  });

  it("stops terra-draw when it unmounts", async () => {
    const { unmount } = renderInPortuguese(
      <LeadMapContext.Provider value={{ map, palette, setDrawing }}>
        <AreaDrawControl onAreaDrawn={vi.fn()} />
      </LeadMapContext.Provider>,
    );
    const draw = await readyDraw();
    unmount();
    expect(draw.stopped).toBe(true);
  });

  it("keeps the buttons disabled without a map", () => {
    renderInPortuguese(
      <LeadMapContext.Provider value={{ map: null, palette, setDrawing }}>
        <AreaDrawControl onAreaDrawn={vi.fn()} />
      </LeadMapContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Polígono" })).toBeDisabled();
  });
});
