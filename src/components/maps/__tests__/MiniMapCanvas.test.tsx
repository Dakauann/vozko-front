import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import { distanceMeters } from "@/lib/maps/geometry";

import { MiniMapCanvas } from "../MiniMapCanvas";
import { renderInPortuguese } from "./intl";

const fakes = vi.hoisted(() => ({
  maps: [] as Array<{ options: Record<string, unknown>; jumps: unknown[]; removed: boolean; fire: (event: string, payload?: unknown) => void }>,
  markers: [] as Array<{
    options: { draggable: boolean; element: HTMLElement };
    position: [number, number] | null;
    draggable: boolean;
    fire: (event: string) => void;
    setLngLat: (position: [number, number]) => unknown;
  }>,
}));

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

vi.mock("maplibre-gl", () => {
  class FakeMap {
    jumps: unknown[] = [];
    removed = false;
    handlers: Record<string, (payload?: unknown) => void> = {};
    constructor(public options: Record<string, unknown>) {
      fakes.maps.push(this);
    }
    on(event: string, handler: (payload?: unknown) => void) {
      this.handlers[event] = handler;
      return this;
    }
    fire(event: string, payload?: unknown) {
      this.handlers[event]?.(payload);
    }
    getLayer() {
      return undefined;
    }
    setPaintProperty() {}
    setLayoutProperty() {}
    jumpTo(options: unknown) {
      this.jumps.push(options);
    }
    remove() {
      this.removed = true;
    }
  }
  class FakeMarker {
    position: [number, number] | null = null;
    draggable: boolean;
    handlers: Record<string, () => void> = {};
    constructor(public options: { draggable: boolean; element: HTMLElement }) {
      this.draggable = options.draggable;
      fakes.markers.push(this);
    }
    setLngLat(position: [number, number]) {
      this.position = position;
      return this;
    }
    addTo() {
      return this;
    }
    on(event: string, handler: () => void) {
      this.handlers[event] = handler;
      return this;
    }
    fire(event: string) {
      this.handlers[event]?.();
    }
    getLngLat() {
      return { lng: this.position?.[0] ?? 0, lat: this.position?.[1] ?? 0 };
    }
    setDraggable(value: boolean) {
      this.draggable = value;
      return this;
    }
  }
  return { Map: FakeMap, Marker: FakeMarker, setWorkerUrl: () => undefined, getVersion: () => "6.13.0" };
});

vi.mock("@/lib/maps/style-loader", () => ({
  loadBaseStyle: () =>
    Promise.resolve({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: {} }] }),
}));

const TOKENS = [
  "--background", "--foreground", "--card", "--popover", "--secondary", "--muted", "--muted-foreground", "--accent-hover",
  "--border", "--border-strong", "--control-edge", "--primary", "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--warning-ink", "--primary-edge",
];

async function loadedMiniMap() {
  await waitFor(() => expect(fakes.maps.length).toBeGreaterThan(0));
  const map = fakes.maps[fakes.maps.length - 1];
  act(() => map.fire("load"));
  return { map, marker: fakes.markers[fakes.markers.length - 1] };
}

describe("MiniMapCanvas", () => {
  beforeEach(() => {
    fakes.maps.length = 0;
    fakes.markers.length = 0;
    for (const token of TOKENS) document.documentElement.style.setProperty(token, "200 20% 50%");
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
  });

  it("says the address has no position instead of drawing an empty map", () => {
    renderInPortuguese(<MiniMapCanvas position={null} />);
    expect(screen.getByText("Endereço ainda sem posição no mapa")).toBeInTheDocument();
    expect(fakes.maps).toHaveLength(0);
  });

  it("refuses an invalid position", () => {
    renderInPortuguese(<MiniMapCanvas position={{ lat: 0, lng: 0 }} />);
    expect(screen.getByText("Endereço ainda sem posição no mapa")).toBeInTheDocument();
  });

  it("frames the address by its precision on a still map", async () => {
    renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} precision="district" />);
    const { map, marker } = await loadedMiniMap();
    expect(map.options).toMatchObject({ center: [-46.65, -23.56], zoom: 13, interactive: false, attributionControl: { compact: true } });
    expect(marker.position).toEqual([-46.65, -23.56]);
    expect(marker.draggable).toBe(false);
    expect(marker.options.element).toHaveAttribute("aria-label", "Posição do endereço");
  });

  it("reports where the pin was dragged", async () => {
    const onPinMoved = vi.fn();
    renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} draggable onPinMoved={onPinMoved} />);
    const { marker } = await loadedMiniMap();
    expect(marker.draggable).toBe(true);
    expect(screen.getByText("Arraste o marcador para corrigir a posição")).toBeInTheDocument();
    marker.setLngLat([-46.66, -23.57]);
    act(() => marker.fire("dragend"));
    expect(onPinMoved).toHaveBeenCalledWith({ lat: -23.57, lng: -46.66 });
  });

  it("keeps a still map unless the pin is being placed", async () => {
    renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} draggable />);
    const { map } = await loadedMiniMap();
    act(() => map.fire("click", { lngLat: { lng: -46.7, lat: -23.6 } }));
    expect(map.options).toMatchObject({ interactive: false });
    expect(fakes.markers[fakes.markers.length - 1].position).toEqual([-46.65, -23.56]);
  });

  it("lets the viewer move and zoom the map to place a pin where they tap", async () => {
    const onPinMoved = vi.fn();
    renderInPortuguese(<MiniMapCanvas position={{ lat: -14.25, lng: -51.45 }} zoom={3} interactive draggable onPinMoved={onPinMoved} />);
    const { map, marker } = await loadedMiniMap();
    expect(map.options).toMatchObject({ center: [-51.45, -14.25], zoom: 3, interactive: true, cooperativeGestures: true });
    act(() => map.fire("click", { lngLat: { lng: -46.7, lat: -23.6 } }));
    expect(marker.position).toEqual([-46.7, -23.6]);
    expect(onPinMoved).toHaveBeenCalledWith({ lat: -23.6, lng: -46.7 });
  });

  it("lets a keyboard user move the pin with the arrows and confirm with Enter", async () => {
    const onPinMoved = vi.fn();
    renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} draggable onPinMoved={onPinMoved} />);
    const { marker } = await loadedMiniMap();
    const pin = marker.options.element;
    expect(pin).toHaveAttribute("tabindex", "0");
    expect(pin).toHaveAttribute("role", "button");
    const hint = document.getElementById(pin.getAttribute("aria-describedby") ?? "");
    expect(hint).toHaveTextContent("Ou foque o marcador e use as setas");
    const start = { lat: -23.56, lng: -46.65 };
    act(() => {
      fireEvent.keyDown(pin, { key: "ArrowUp" });
    });
    const [lngAfterUp, latAfterUp] = marker.position ?? [0, 0];
    expect(lngAfterUp).toBe(start.lng);
    expect(distanceMeters(start, { lat: latAfterUp, lng: lngAfterUp })).toBeCloseTo(5, 3);
    expect(onPinMoved).not.toHaveBeenCalled();
    expect(screen.getByText("Marcador movido. Enter confirma, Esc desfaz.")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(pin, { key: "ArrowRight", shiftKey: true });
    });
    const [lngAfterRight, latAfterRight] = marker.position ?? [0, 0];
    expect(latAfterRight).toBe(latAfterUp);
    expect(distanceMeters({ lat: latAfterUp, lng: lngAfterUp }, { lat: latAfterRight, lng: lngAfterRight })).toBeCloseTo(25, 2);
    act(() => {
      fireEvent.keyDown(pin, { key: "Enter" });
    });
    expect(onPinMoved).toHaveBeenCalledWith({ lat: latAfterRight, lng: lngAfterRight });
    expect(screen.getByText("Nova posição confirmada.")).toBeInTheDocument();
  });

  it("puts the pin back with Escape before it is confirmed", async () => {
    const onPinMoved = vi.fn();
    renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} draggable onPinMoved={onPinMoved} />);
    const { marker } = await loadedMiniMap();
    const pin = marker.options.element;
    act(() => {
      fireEvent.keyDown(pin, { key: "ArrowLeft" });
      fireEvent.keyDown(pin, { key: "ArrowDown" });
      fireEvent.keyDown(pin, { key: "Escape" });
    });
    expect(marker.position).toEqual([-46.65, -23.56]);
    act(() => {
      fireEvent.keyDown(pin, { key: "Enter" });
    });
    expect(onPinMoved).not.toHaveBeenCalled();
    expect(screen.getByText("Movimento desfeito.")).toBeInTheDocument();
  });

  it("keeps a still pin out of the tab order", async () => {
    renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} />);
    const { marker } = await loadedMiniMap();
    const pin = marker.options.element;
    expect(pin).not.toHaveAttribute("tabindex");
    expect(pin).toHaveAttribute("role", "img");
    const before = marker.position;
    fireEvent.keyDown(pin, { key: "ArrowUp" });
    expect(marker.position).toEqual(before);
  });

  it("follows a new position", async () => {
    const { rerender } = renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} precision="exact" />);
    const { map, marker } = await loadedMiniMap();
    rerender(<MiniMapCanvas position={{ lat: -22.9, lng: -43.17 }} precision="exact" />);
    await waitFor(() => expect(marker.position).toEqual([-43.17, -22.9]));
    expect(map.jumps).toContainEqual({ center: [-43.17, -22.9], zoom: 16 });
  });

  it("removes the map when it unmounts", async () => {
    const { unmount } = renderInPortuguese(<MiniMapCanvas position={{ lat: -23.56, lng: -46.65 }} />);
    const { map } = await loadedMiniMap();
    unmount();
    expect(map.removed).toBe(true);
  });
});
