import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { emptyCrmFilter } from "@/lib/crm/board";
import { withDrawnArea } from "@/lib/leads/map-view";
import type { AudienceDraft, LeadsPickDraft } from "@/lib/campaign-audience/draft";
import type { AudienceCount, AudienceChannel } from "@/lib/campaign-audience/types";
import type { MapSample } from "@/lib/maps/types";

const access = vi.hoisted(() => ({ addresses: true }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: (resource: string, action: string) => resource !== "leads" || action !== "read_addresses" || access.addresses }),
}));

const toolbar = vi.hoisted(() => ({ next: null as unknown }));
vi.mock("@/components/leads/LeadsToolbar", () => ({
  LeadsToolbar: ({ onFilterChange }: { onFilterChange: (filter: unknown) => void }) => (
    <button type="button" onClick={() => onFilterChange(toolbar.next)}>
      trocar filtro
    </button>
  ),
}));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));
vi.mock("@/components/leads/sheet/LeadSheet", () => ({ LeadSheet: () => null }));

const map = vi.hoisted(() => ({ props: null as null | { layer: unknown; areas: unknown; bounds: unknown } }));
vi.mock("@/components/maps/LeadMap", () => ({
  LeadMap: (props: { layer: unknown; areas: unknown; bounds: unknown; ariaLabel?: string }) => {
    map.props = props;
    return <div role="img" aria-label={props.ariaLabel} />;
  },
}));

const areas = vi.hoisted(() => ({ enabled: [] as boolean[] }));
vi.mock("@/hooks/use-lead-map", () => ({
  useLeadAreas: ({ enabled }: { enabled: boolean }) => {
    areas.enabled.push(enabled);
    return {
      data: enabled
        ? [
            { id: "area-1", name: "Centro", visibility: "private", shape: { kind: "circle", center: { lat: -23.55, lng: -46.63 }, radiusM: 900 } },
            { id: "area-2", name: "Sul", visibility: "private", shape: { kind: "circle", center: { lat: -23.6, lng: -46.7 }, radiusM: 500 } },
          ]
        : undefined,
    };
  },
}));

const actions = vi.hoisted(() => ({
  countAudienceAction: vi.fn(),
  listAudienceFieldsAction: vi.fn(),
  listAudienceLeadsAction: vi.fn(),
  mapAudienceAction: vi.fn(),
  uploadAudienceListAction: vi.fn(),
  pasteAudienceListAction: vi.fn(),
  previewAudienceListAction: vi.fn(),
  searchAudienceRowsAction: vi.fn(),
  addAudienceRowAction: vi.fn(),
  editAudienceRowAction: vi.fn(),
  removeAudienceRowAction: vi.fn(),
  downloadAudienceSampleAction: vi.fn(),
  listTemplateFieldsAction: vi.fn(),
}));
vi.mock("@/app/actions/campaign-audience", () => actions);

import { CampaignAudienceStep } from "../CampaignAudienceStep";
import { useCampaignAudience } from "../use-campaign-audience";

const copy = ptMessages.campaignAudience.step.map;
const SETTLE = { timeout: 3000 };
const IN_CENTRO = withDrawnArea(emptyCrmFilter, "area-1");
const IN_SUL = withDrawnArea(emptyCrmFilter, "area-2");

const COUNTED: AudienceCount = {
  channel: "whatsapp",
  source: "leads",
  matched: 12,
  withContact: 12,
  sendable: 12,
  out: {},
  outTotal: 0,
  requiredVariables: 0,
  variables: [],
  blockers: [],
  selection: { selected: 12, confirmCount: 12, fingerprint: "fp" },
  list: null,
  metadataMissing: [],
};

const SAMPLE: MapSample = {
  layer: { kind: "points", points: [{ id: "-23.55,-46.63", lat: -23.55, lng: -46.63, precision: "street", placement: "on_map", tone: "neutral", count: 3, leadIds: ["l1", "l2", "l3"] }] },
  located: 3,
  positions: 1,
  sampled: false,
  bounds: { south: -23.56, west: -46.64, north: -23.54, east: -46.62 },
};

function Harness({ channel, initial, onEditMap, readOnly }: { channel: AudienceChannel; initial: Partial<AudienceDraft>; onEditMap?: (pick: LeadsPickDraft) => void; readOnly?: boolean }) {
  const audience = useCampaignAudience({ channel, fields: {}, initial });
  return <CampaignAudienceStep audience={audience} onEditMap={onEditMap} readOnly={readOnly} />;
}

function renderStep(channel: AudienceChannel, initial: Partial<AudienceDraft>, extra: { onEditMap?: (pick: LeadsPickDraft) => void; readOnly?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <Harness channel={channel} initial={initial} {...extra} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function countedSpecs() {
  return actions.countAudienceAction.mock.calls.map((call) => call[1]);
}

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset());
  access.addresses = true;
  areas.enabled = [];
  map.props = null;
  toolbar.next = IN_SUL;
  actions.listAudienceFieldsAction.mockResolvedValue({ data: [], error: null });
  actions.countAudienceAction.mockResolvedValue({ data: COUNTED, error: null });
  actions.listAudienceLeadsAction.mockResolvedValue({ data: { items: [], page: 1, pageSize: 5, totalPages: 0, totalItems: 0 }, error: null });
  actions.mapAudienceAction.mockResolvedValue({ data: SAMPLE, error: null });
});

describe("AudienceMapPreview", () => {
  it("stays away while the filter has no area", async () => {
    renderStep("email", { source: "leads", pick: "everyone" });
    await waitFor(() => expect(actions.countAudienceAction).toHaveBeenCalled(), SETTLE);
    expect(screen.queryByText(copy.title)).toBeNull();
    expect(actions.mapAudienceAction).not.toHaveBeenCalled();
    expect(areas.enabled.every((enabled) => !enabled)).toBe(true);
  });

  it("draws the areas and the matched leads the server places for the counted spec", async () => {
    renderStep("whatsapp", { source: "leads", pick: "filter", filter: IN_CENTRO });
    expect(await screen.findByText(copy.title, undefined, SETTLE)).toBeInTheDocument();
    await waitFor(() => expect(map.props).not.toBeNull());
    const [channel, spec, signal] = actions.mapAudienceAction.mock.calls[0];
    expect(channel).toBe("whatsapp");
    expect(spec).toEqual({ source: "leads", selection: countedSpecs()[0].selection });
    expect(spec.selection.filter).toEqual(IN_CENTRO);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(map.props?.layer).toEqual(SAMPLE.layer);
    expect(map.props?.bounds).toEqual(SAMPLE.bounds);
    expect(map.props?.areas).toEqual([{ kind: "circle", center: { lat: -23.55, lng: -46.63 }, radiusM: 900 }]);
    expect(screen.getByText("3 leads com posição nas áreas")).toBeInTheDocument();
  });

  it("says when the map shows a sample of the positions", async () => {
    actions.mapAudienceAction.mockResolvedValue({ data: { ...SAMPLE, located: 4200, positions: 3100, sampled: true }, error: null });
    renderStep("unofficial", { source: "leads", pick: "filter", filter: IN_CENTRO });
    expect(await screen.findByText("4.200 leads com posição. Mostrando 1 de 3.100 pontos.", undefined, SETTLE)).toBeInTheDocument();
  });

  it("says when nobody in the audience has a position inside the areas", async () => {
    actions.mapAudienceAction.mockResolvedValue({ data: { ...SAMPLE, layer: { kind: "points", points: [] }, located: 0, positions: 0 }, error: null });
    renderStep("email", { source: "leads", pick: "filter", filter: IN_CENTRO });
    expect(await screen.findByText(copy.empty, undefined, SETTLE)).toBeInTheDocument();
  });

  it("stays away from a member who cannot read addresses", async () => {
    access.addresses = false;
    renderStep("whatsapp", { source: "leads", pick: "filter", filter: IN_CENTRO });
    await waitFor(() => expect(actions.countAudienceAction).toHaveBeenCalled(), SETTLE);
    expect(screen.queryByText(copy.title)).toBeNull();
    expect(actions.mapAudienceAction).not.toHaveBeenCalled();
  });

  it("aborts the map the audience no longer needs once the areas change", async () => {
    actions.mapAudienceAction.mockImplementationOnce(() => new Promise(() => undefined)).mockResolvedValue({ data: SAMPLE, error: null });
    renderStep("whatsapp", { source: "leads", pick: "filter", filter: IN_CENTRO });
    await waitFor(() => expect(actions.mapAudienceAction).toHaveBeenCalledTimes(1), SETTLE);
    const first = actions.mapAudienceAction.mock.calls[0][2] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "trocar filtro" }));
    await waitFor(() => expect(actions.mapAudienceAction).toHaveBeenCalledTimes(2), SETTLE);
    expect(actions.mapAudienceAction.mock.calls[1][1].selection.filter).toEqual(IN_SUL);
    await waitFor(() => expect(first.aborted).toBe(true));
  });

  it("hands the current pick to the map editor", async () => {
    const onEditMap = vi.fn();
    renderStep("email", { source: "leads", pick: "filter", filter: IN_CENTRO, search: "ana" }, { onEditMap });
    fireEvent.click(await screen.findByRole("button", { name: copy.edit }, SETTLE));
    expect(onEditMap).toHaveBeenCalledTimes(1);
    expect(onEditMap.mock.calls[0][0]).toMatchObject({ filter: IN_CENTRO, search: "ana" });
  });

  it("offers no editing when the step is read only or has no draft to return to", async () => {
    const { unmount } = renderStep("email", { source: "leads", pick: "filter", filter: IN_CENTRO }, { onEditMap: vi.fn(), readOnly: true });
    expect(await screen.findByText(copy.title, undefined, SETTLE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.edit })).toBeNull();
    unmount();
    renderStep("email", { source: "leads", pick: "filter", filter: IN_CENTRO });
    expect(await screen.findByText(copy.title, undefined, SETTLE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.edit })).toBeNull();
  });
});
