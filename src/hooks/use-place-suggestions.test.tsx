import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchPlaces = vi.fn();
vi.mock("@/app/actions/places", () => ({
  fetchPlaces: (...args: unknown[]) => fetchPlaces(...args),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }),
}));

import { usePlaceSuggestions } from "./use-place-suggestions";
import type { PlaceRequest } from "@/lib/maps/places";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("usePlaceSuggestions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchPlaces.mockReset();
    fetchPlaces.mockImplementation(async () => ({ answer: { places: [], coveredStates: ["PE"], attribution: "IBGE" }, error: null }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits 250 ms after the last keystroke and asks once per folded prefix", async () => {
    const { result, rerender } = renderHook(({ request }: { request: PlaceRequest }) => usePlaceSuggestions(request), {
      wrapper: wrapper(),
      initialProps: { request: { kind: "city", text: "", state: "PE" } },
    });
    rerender({ request: { kind: "city", text: "re", state: "PE" } });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    rerender({ request: { kind: "city", text: "rec", state: "PE" } });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(fetchPlaces).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(60);
    });
    await waitFor(() => expect(fetchPlaces).toHaveBeenCalledTimes(1));
    expect(fetchPlaces.mock.calls[0][0]).toMatchObject({ kind: "city", text: "rec", state: "PE" });
    await waitFor(() => expect(result.current.coveredStates).toEqual(["PE"]));

    rerender({ request: { kind: "city", text: "REC", state: "pe" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(fetchPlaces).toHaveBeenCalledTimes(1);
  });

  it("never asks for bairros without a city", async () => {
    renderHook(() => usePlaceSuggestions({ kind: "district", text: "boa" }), { wrapper: wrapper() });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(fetchPlaces).not.toHaveBeenCalled();
  });

  it("reads the loaded states from a refusal", async () => {
    fetchPlaces.mockImplementation(async () => ({ answer: null, error: { code: "reference_not_loaded", expected: { coveredStates: "DF,PE" } } }));
    const { result } = renderHook(() => usePlaceSuggestions({ kind: "city", text: "sao", state: "SP" }), { wrapper: wrapper() });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => expect(result.current.error?.code).toBe("reference_not_loaded"));
    expect(result.current.coveredStates).toEqual(["DF", "PE"]);
  });
});
