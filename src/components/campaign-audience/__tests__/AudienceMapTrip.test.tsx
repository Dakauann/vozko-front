import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { emptyAudienceDraft } from "@/lib/campaign-audience/draft";
import { emptyCrmFilter } from "@/lib/crm/board";
import { withAreaSelection, withDrawnArea } from "@/lib/leads/map-view";

const { router, search, toastMock } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  search: { value: "" },
  toastMock: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { AudienceMapReturn } from "../AudienceMapReturn";
import { useMapTrip, useReturnedAreas } from "../use-audience-map-trip";

const trip = ptMessages.campaignAudience.mapTrip;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function pushed(): URL {
  return new URL(router.push.mock.calls.at(-1)?.[0] as string, "https://app.test");
}

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  toastMock.error.mockReset();
  search.value = "";
});

describe("leaving the audience step for the map", () => {
  it("saves the draft and opens the map on its filter", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useMapTrip({ channel: "whatsapp", draftId: "draft-1" }, save), { wrapper });
    const pick = { ...emptyAudienceDraft("whatsapp"), filter: withDrawnArea(emptyCrmFilter, "area-1") };
    await act(async () => result.current?.(pick));
    expect(save).toHaveBeenCalledTimes(1);
    const url = pushed();
    expect(url.pathname).toBe("/dashboard/leads");
    expect(url.searchParams.get("view")).toBe("map");
    expect(url.searchParams.get("audienceChannel")).toBe("whatsapp");
    expect(url.searchParams.get("audienceDraft")).toBe("draft-1");
    expect(url.searchParams.get("filter")).not.toBeNull();
  });

  it("stays on the step when the draft cannot be saved", async () => {
    const save = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useMapTrip({ channel: "email", draftId: "c1" }, save), { wrapper });
    await act(async () => result.current?.(emptyAudienceDraft("email")));
    expect(router.push).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith(ptMessages.campaignAudience.step.map.saveFirst);
  });

  it("offers no trip before the draft exists", () => {
    const { result } = renderHook(() => useMapTrip(null, vi.fn()), { wrapper });
    expect(result.current).toBeUndefined();
  });
});

describe("coming back from the map", () => {
  it.each([
    ["whatsapp", "/dashboard/whatsapp-campaigns/new", "draft"],
    ["unofficial", "/dashboard/unofficial-whatsapp-campaigns/new", "draft"],
    ["email", "/dashboard/email/campaigns/new", "campaign"],
  ] as const)("takes the areas chosen on the map back to the same %s draft and step", (channel, path, draftParam) => {
    search.value = `view=map&audienceChannel=${channel}&audienceDraft=draft-9`;
    const filter = withAreaSelection(emptyCrmFilter, { ids: ["area-2", "area-3"], exactOnly: false });
    render(<AudienceMapReturn filter={filter} />, { wrapper });
    expect(screen.getByText("2 áreas selecionadas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: trip.apply }));
    const url = pushed();
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get(draftParam)).toBe("draft-9");
    expect(url.searchParams.get("step")).toBe("audience");
    expect(url.searchParams.get("areas")).toBe("area-2,area-3");
    fireEvent.click(screen.getByRole("button", { name: trip.cancel }));
    const back = pushed();
    expect(back.pathname).toBe(path);
    expect(back.searchParams.get("step")).toBe("audience");
    expect(back.searchParams.get("areas")).toBeNull();
  });

  it("shows nothing on a lead map opened without a campaign", () => {
    search.value = "view=map";
    const { container } = render(<AudienceMapReturn filter={emptyCrmFilter} />, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it("reads the returned areas once and drops them from the address", () => {
    search.value = "draft=draft-9&step=audience&areas=area-2&areasExact=1";
    const { result, rerender } = renderHook(() => useReturnedAreas("/dashboard/whatsapp-campaigns/new?draft=draft-9&step=audience"));
    expect(result.current).toEqual({ ids: ["area-2"], exactOnly: true });
    search.value = "draft=draft-9&step=audience";
    rerender();
    expect(result.current).toEqual({ ids: ["area-2"], exactOnly: true });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/dashboard/whatsapp-campaigns/new?draft=draft-9&step=audience", { scroll: false });
  });

  it("leaves the address alone when nothing came back", () => {
    search.value = "draft=draft-9&step=audience";
    const { result } = renderHook(() => useReturnedAreas("/dashboard/whatsapp-campaigns/new?draft=draft-9&step=audience"));
    expect(result.current).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
