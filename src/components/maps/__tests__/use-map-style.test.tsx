import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

import { MAP_TOKEN_NAMES } from "@/lib/maps/palette";

import { useMapStyle } from "../use-map-style";

const loader = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("@/lib/maps/style-loader", () => ({ loadBaseStyle: (url: string) => loader.load(url) }));

const baseStyle = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: {} }] };

function Probe({ tick }: { tick: number }) {
  const state = useMapStyle();
  return (
    <span data-testid="probe" data-tick={tick} data-failure={state.failure ?? ""}>
      {state.status}
    </span>
  );
}

describe("useMapStyle", () => {
  beforeEach(() => {
    loader.load.mockReset();
    loader.load.mockResolvedValue(baseStyle);
    document.documentElement.className = "light";
    for (const token of MAP_TOKEN_NAMES) document.documentElement.style.setProperty(token, "200 20% 50%");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    document.documentElement.removeAttribute("style");
    document.documentElement.className = "";
  });

  it("reads the theme once per change, not on every render", async () => {
    const computed = vi.spyOn(window, "getComputedStyle");
    const { rerender } = render(<Probe tick={0} />);
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("ready"));
    const reads = computed.mock.calls.length;
    for (let tick = 1; tick <= 5; tick++) rerender(<Probe tick={tick} />);
    expect(computed.mock.calls.length).toBe(reads);
    act(() => {
      document.documentElement.style.setProperty("--card", "210 12% 9%");
    });
    await waitFor(() => expect(computed.mock.calls.length).toBeGreaterThan(reads));
  });

  it("labels the basemap in the language it is given, keeping the token recolouring", async () => {
    loader.load.mockResolvedValue({
      ...baseStyle,
      layers: [
        ...baseStyle.layers,
        { id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place", layout: { "text-field": ["get", "name_en"], "text-font": ["Noto Sans Bold"] }, paint: {} },
      ],
    });
    function Labels() {
      const state = useMapStyle("pt");
      const city = state.style?.layers.find((layer) => layer.id === "label_city") as { layout?: Record<string, unknown>; paint?: Record<string, unknown> } | undefined;
      return (
        <span data-testid="labels" data-bold={state.boldFont.join(",")} data-color={String(city?.paint?.["text-color"] ?? "")}>
          {JSON.stringify(city?.layout?.["text-field"] ?? null)}
        </span>
      );
    }
    render(<Labels />);
    await waitFor(() => expect(screen.getByTestId("labels")).toHaveTextContent("name:pt"));
    expect(screen.getByTestId("labels")).toHaveTextContent(JSON.stringify(["coalesce", ["get", "name:latin"], ["get", "name"]]));
    expect(screen.getByTestId("labels")).not.toHaveTextContent("name_en");
    expect(screen.getByTestId("labels")).toHaveAttribute("data-bold", "Noto Sans Bold");
    expect(screen.getByTestId("labels")).toHaveAttribute("data-color", "hsl(200, 20%, 50%)");
  });

  it("refuses a misconfigured basemap address as a configuration failure, without fetching", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", "ftp://tiles.example.com/style.json");
    render(<Probe tick={0} />);
    const probe = screen.getByTestId("probe");
    expect(probe).toHaveTextContent("error");
    expect(probe).toHaveAttribute("data-failure", "configuration");
    expect(loader.load).not.toHaveBeenCalled();
  });

  it("reports an unreachable basemap as unavailable, so the page can offer a retry", async () => {
    loader.load.mockRejectedValue(new Error("offline"));
    render(<Probe tick={0} />);
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveAttribute("data-failure", "unavailable"));
  });
});
