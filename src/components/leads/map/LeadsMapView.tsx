"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { createLeadAreaAction, fetchLeadMapPoint } from "@/app/actions/lead-map";
import { getLeadByIdAction } from "@/app/actions/leads";
import { RetryNotice } from "@/components/elevated-design/retry-notice";
import { X } from "@/components/icons";
import { LeadSendDialog } from "@/components/leads/sends/LeadSendDialog";
import { useLeadSendGate } from "@/components/leads/sends/use-lead-send-gate";
import { DistrictList } from "@/components/maps/DistrictList";
import type { RadiusCenter } from "@/components/maps/RadiusFromPlace";
import { GeoSummaryPanel, type GeoLeftOutView } from "@/components/maps/GeoSummaryPanel";
import { LeadMap } from "@/components/maps/LeadMap";
import { MapEmptyState, type MapEmptyActionProps } from "@/components/maps/MapEmptyState";
import { MapLegend } from "@/components/maps/MapLegend";
import { BESIDE_MAP_PANEL, MAP_FLOATY } from "@/components/maps/map-layout";
import { MapFailure } from "@/components/maps/MapStatus";
import { MapPlaceSearch, placeFilterOf, type Place } from "@/components/maps/MapPlaceSearch";
import { MapSummary } from "@/components/maps/MapSummary";
import { useInView } from "@/hooks/use-in-view";
import {
  leadAreasKey,
  useLeadMapDistricts,
  useLeadMapLayer,
  useLeadMapLeftOut,
  useLeadMapSummary,
  useLeadMapViewport,
} from "@/hooks/use-lead-map";
import { useLeadSection } from "@/hooks/use-lead-section";
import { useWorkspace } from "@/contexts/workspace-context";
import { isBusySectionError, sectionErrorCode } from "@/lib/analytics/section-query";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { LeadFilter } from "@/lib/leads/filters";
import {
  addressRequestSelection,
  areaIdsOf,
  centeredPeek,
  chosenColourField,
  colourFieldsOf,
  colourLegend,
  defaultLayerMode,
  focusPoint,
  leadMapAvailability,
  leadMapColorOf,
  leadMapFocusOf,
  leadMapLayerOf,
  leftOutListFilter,
  nothingOnMap,
  offMapFilter,
  peekPlacement,
  pickedLeadIds,
  pointBounds,
  withDistrictPairs,
  withDrawnArea,
  withLeadMapParam,
  withPick,
  withoutArea,
  withoutLeadMapFocus,
  withoutPick,
  visibleByPlacement,
  LEAD_MAP_COLOR_PARAM,
  LEAD_MAP_LAYER_PARAM,
  type MapPicks,
  type OffMapKey,
} from "@/lib/leads/map-view";
import { zoomForPrecision } from "@/lib/maps/precision";
import type { AreaShape, BBox, DistrictCount, DrawnArea, MapGoTo, MapLayerMode, MapPlaceMarker, MapPoint, SnappedViewport } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { AreaManager } from "./AreaManager";
import { LeadMapPeek, PEEK_SIZE } from "./LeadMapPeek";
import { MapLayerBar } from "./MapLayerBar";

export interface LeadsMapViewProps {
  filter: LeadFilter;
  search: string;
  onFilterChange: (filter: LeadFilter) => void;
  onShowTable: (filter?: LeadFilter) => void;
  areas: readonly DrawnArea[];
  picks: MapPicks;
  onPicksChange: (picks: MapPicks) => void;
  classification?: CustomFieldDefinition;
  fields?: readonly CustomFieldDefinition[];
  canCreateLead: boolean;
  onImport: () => void;
  onCreateLead: () => void;
  selectionBar: (view: MapSelectionBarView) => ReactNode;
  className?: string;
}

export interface MapSelectionBarView {
  total: number | null;
  inArea: boolean;
}

interface OpenPeek {
  point: MapPoint;
  placement: { left: number; top: number };
}

interface MapFocus {
  district: string | null;
  bounds: BBox;
}

type FocusProblem = { leadId: string; reason: "unplaced" | "failed" };

const AREA_NAME_FORMAT = { dateStyle: "short", timeStyle: "short" } as const;

const KILOMETER = 1000;

const NO_FIELDS: readonly CustomFieldDefinition[] = [];

const FIT_PADDING = { top: 64, right: 336, bottom: 40, left: 64 };

const MAP_NOTICE = cn("px-2.5 py-1.5 text-xs", MAP_FLOATY);

const OFF_MAP_KEYS: readonly OffMapKey[] = ["approximate", "withoutAddress", "notFound", "pending", "quotaExceeded", "refused"];

export function LeadsMapView({
  filter,
  search,
  onFilterChange,
  onShowTable,
  areas,
  picks,
  onPicksChange,
  classification,
  fields = NO_FIELDS,
  canCreateLead,
  onImport,
  onCreateLead,
  selectionBar,
  className,
}: LeadsMapViewProps) {
  const t = useTranslations("leadMap");
  const tAreas = useTranslations("leadMap.areas");
  const tDistricts = useTranslations("leadMap.districtList");
  const tCommon = useTranslations("metricsOps.common");
  const tLeads = useTranslations("leadsPage");
  const tSendBlockers = useTranslations("leadSends.blockers");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const sends = useLeadSendGate();
  const [inViewRef, inView] = useInView<HTMLDivElement>();
  const frame = useRef<HTMLDivElement | null>(null);
  const attachFrame = useCallback(
    (node: HTMLDivElement | null) => {
      frame.current = node;
      inViewRef(node);
    },
    [inViewRef],
  );

  const params = useMemo(() => ({ filter, q: search }), [filter, search]);
  const filterKey = JSON.stringify([filter, search]);
  const focusLeadId = leadMapFocusOf(searchParams);
  const chosenLayer = leadMapLayerOf(searchParams);

  const [snapped, setSnapped] = useState<SnappedViewport | null>(null);
  const [peek, setPeek] = useState<OpenPeek | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [focusFilter, setFocusFilter] = useState(filterKey);
  const [focusProblem, setFocusProblem] = useState<FocusProblem | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [placeView, setPlaceView] = useState<{ goTo: MapGoTo; marker: MapPlaceMarker | null } | null>(null);

  if (focusFilter !== filterKey) {
    setFocusFilter(filterKey);
    setFocus(null);
    setPeek(null);
  }

  const viewport = useLeadMapViewport(params, { enabled: inView });
  const [viewportSettled, setViewportSettled] = useState(false);
  if (!viewportSettled && (viewport.isSuccess || viewport.isError)) setViewportSettled(true);
  const summary = useLeadMapSummary(params, { enabled: inView });
  const districts = useLeadMapDistricts(params, { enabled: inView });

  const colourFields = useMemo(() => colourFieldsOf(fields), [fields]);
  const colourField = chosenColourField(fields, leadMapColorOf(searchParams));
  const colorBy = colourField?.key;

  const wantsPositions = (chosenLayer ?? defaultLayerMode(viewport.data?.view, null)) !== "districts";
  const layerRequest = snapped ? (colorBy ? { viewport: snapped, colorBy } : { viewport: snapped }) : null;
  const layer = useLeadMapLayer(params, layerRequest, { enabled: inView && viewportSettled && wantsPositions });
  const mode: MapLayerMode = chosenLayer ?? defaultLayerMode(viewport.data?.view, layer.data?.kind ?? null);
  const facets = useLeadSection("facets", { ...params, colorBy }, { enabled: inView && colorBy !== undefined });

  const activeAreaIds = areaIdsOf(filter);
  const activeAreas = useMemo(
    () =>
      areaIdsOf(filter)
        .map((id) => areas.find((area) => area.id === id))
        .filter((area): area is DrawnArea => area !== undefined),
    [filter, areas],
  );
  const outlined: AreaShape[] = useMemo(() => activeAreas.map((area) => area.shape), [activeAreas]);
  const leftOut = useLeadMapLeftOut(params, { enabled: inView && activeAreaIds.length > 0 });

  const availability = [viewport.error, summary.error, districts.error, layer.error]
    .map(leadMapAvailability)
    .find((state) => state !== "ready") ?? "ready";

  useEffect(() => {
    if (!focusLeadId || !inView) return;
    const controller = new AbortController();
    const settle = (problem: FocusProblem["reason"] | null, point: MapPoint | null) => {
      if (controller.signal.aborted) return;
      if (!point) {
        setFocusProblem({ leadId: focusLeadId, reason: problem ?? "failed" });
        return;
      }
      setFocusProblem(null);
      setFocus({ district: null, bounds: pointBounds(point) });
      const size = { width: frame.current?.clientWidth ?? 0, height: frame.current?.clientHeight ?? 0 };
      setPeek({ point, placement: centeredPeek(size, PEEK_SIZE) });
    };
    getLeadByIdAction(focusLeadId, controller.signal)
      .then((read) => {
        const point = read.lead ? focusPoint(read.lead) : null;
        settle(read.lead ? "unplaced" : "failed", point);
      })
      .catch(() => settle("failed", null));
    return () => controller.abort();
  }, [focusLeadId, inView]);

  const replaceQuery = (query: string) => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });

  const clearFocus = () => {
    if (!focusLeadId) return;
    replaceQuery(withoutLeadMapFocus(searchParams));
  };

  const closePeek = () => {
    setPeek(null);
    clearFocus();
  };

  const chooseLayer = (next: MapLayerMode) => {
    setPeek(null);
    replaceQuery(withLeadMapParam(searchParams, LEAD_MAP_LAYER_PARAM, next));
  };

  const chooseColour = (key: string) => replaceQuery(withLeadMapParam(searchParams, LEAD_MAP_COLOR_PARAM, key));

  const layerData = mode === "districts" ? null : layer.data ?? null;
  const visible = useMemo(() => visibleByPlacement(layerData), [layerData]);

  const colourValues =
    facets.data?.classification && colourField && facets.data.classification.key === colourField.key
      ? facets.data.classification.values
      : undefined;
  const colourRows = colourField && summary.data ? colourLegend(colourField, colourValues, summary.data.total) : [];
  const panelColour = colourField ? { field: colourField.label, rows: colourValues ? colourRows : [], failed: facets.isError } : null;

  const pickedIds = useMemo(() => pickedLeadIds(picks), [picks]);
  const selectedPointIds = useMemo(() => Object.keys(picks), [picks]);

  const proposeName = () => t("areas.proposedName", { date: format.dateTime(new Date(), AREA_NAME_FORMAT) });

  const saveArea = async (shape: AreaShape, name = proposeName()) => {
    const saved = await createLeadAreaAction({ name, visibility: "private", shape });
    if (!saved.area) {
      toast.error(codedErrorMessage(tAreas, saved.error, tAreas("failed")));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: leadAreasKey(workspaceId) });
    onFilterChange(withDrawnArea(filter, saved.area.id));
    toast.success(t("areas.saved"));
  };

  const saveRadius = (center: RadiusCenter, radiusM: number) => {
    const radius =
      radiusM < KILOMETER
        ? tDistricts("radius.meters", { value: radiusM })
        : tDistricts("radius.kilometers", { value: radiusM / KILOMETER });
    void saveArea(
      { kind: "circle", center: { lat: center.lat, lng: center.lng }, radiusM },
      t("areas.radiusName", { radius, name: center.name }),
    );
  };

  const toggleArea = (areaId: string) =>
    onFilterChange(activeAreaIds.includes(areaId) ? withoutArea(filter, areaId) : withDrawnArea(filter, areaId));

  const forgetArea = (areaId: string) => {
    if (activeAreaIds.includes(areaId)) onFilterChange(withoutArea(filter, areaId));
  };

  const togglePick = async (point: MapPoint) => {
    if (picks[point.id]) {
      onPicksChange(withoutPick(picks, point.id));
      return;
    }
    if (point.count <= point.leadIds.length) {
      onPicksChange(withPick(picks, point.id, point.leadIds));
      return;
    }
    try {
      const people = await fetchLeadMapPoint(params, { lat: point.lat, lng: point.lng, placement: point.placement });
      const ids = people.items.map((lead) => lead.id);
      onPicksChange(withPick(picks, point.id, ids));
      if (people.total > ids.length) toast.message(t("selection.partial", { count: ids.length }));
    } catch {
      toast.error(t("selection.failed"));
    }
  };

  const goToPlace = (place: Place) => {
    const key = (placeView?.goTo.key ?? 0) + 1;
    setPlaceView(
      place.bounds
        ? { goTo: { key, bounds: place.bounds }, marker: { kind: "bounds", bounds: place.bounds } }
        : { goTo: { key, center: place.position, zoom: zoomForPrecision(place.precision) }, marker: { kind: "point", at: place.position } },
    );
  };

  const filterByPlace = (place: Place) => {
    const next = placeFilterOf(place, filter);
    if (next) onFilterChange(next);
  };

  const showDistrict = (district: DistrictCount) => {
    setFocus({ district: district.pair, bounds: pointBounds(district) });
  };

  const containerSize = () => ({ width: frame.current?.clientWidth ?? 0, height: frame.current?.clientHeight ?? 0 });

  const layerFailed = mode !== "districts" && layer.isError && availability === "ready";
  const viewportFailed = viewport.isError && availability === "ready";
  const viewportFailure = isBusySectionError(viewport.error)
    ? tCommon("sectionBusy")
    : codedErrorMessage(tLeads, { code: sectionErrorCode(viewport.error) ?? undefined }, t("viewportFailed"));
  const empty = nothingOnMap(summary.data ?? null, districts.data ?? null);

  const offMapActions = Object.fromEntries(
    OFF_MAP_KEYS.map((key) => [key, () => onShowTable(offMapFilter(filter, key))]),
  ) as Record<OffMapKey, () => void>;

  const leftOutData = leftOut.data ?? null;
  const leftOutView: GeoLeftOutView | null =
    activeAreaIds.length > 0
      ? {
          counts: leftOutData,
          failed: leftOut.isError,
          busy: isBusySectionError(leftOut.error),
          onRetry: () => void leftOut.refetch(),
          retrying: leftOut.isFetching,
          onList: leftOutData?.filter
            ? (pair?: string) => {
                const listed = leftOutListFilter(leftOutData, pair);
                if (listed) onShowTable(listed);
              }
            : undefined,
        }
      : null;

  const withoutAddressCount = summary.data?.withoutAddress ?? 0;
  const requestAddress: MapEmptyActionProps = !sends.send_template.enabled
    ? { disabledReason: tSendBlockers(sends.send_template.reason) }
    : withoutAddressCount === 0
      ? { disabledReason: t("empty.reasons.nobodyWithoutAddress") }
      : { onSelect: () => setRequesting(true) };

  const shownFocusProblem = focusProblem && focusProblem.leadId === focusLeadId ? focusProblem : null;

  const placeSearch = <MapPlaceSearch onSelect={goToPlace} onFilter={filterByPlace} filter={filter} className="w-64 max-sm:w-44" />;

  const tools = empty ? (
    placeSearch
  ) : (
    <>
      <MapLayerBar mode={mode} onModeChange={chooseLayer} fields={colourFields} colourKey={colorBy} onColourChange={chooseColour}>
        {areas.length > 0 ? <AreaManager areas={areas} activeIds={activeAreaIds} onToggle={toggleArea} onDeleted={forgetArea} /> : null}
      </MapLayerBar>
      {placeSearch}
    </>
  );

  const notices = shownFocusProblem || viewportFailed || layerFailed;

  const body =
    availability === "unavailable" ? (
      <MapFailure message={t("unavailable")} />
    ) : (
      <LeadMap
        layer={layerData}
        districts={districts.data ?? null}
        mode={mode}
        coloured={colourField !== undefined}
        selectedPointIds={selectedPointIds}
        allSelected={activeAreas.length > 0}
        areas={outlined}
        bounds={focus?.bounds ?? viewport.data?.bbox ?? null}
        fitPadding={FIT_PADDING}
        ariaLabel={t("mapLabel")}
        onViewportChange={setSnapped}
        onPointClick={(point, at) => setPeek({ point, placement: peekPlacement(at, containerSize(), PEEK_SIZE) })}
        onPointShiftClick={(point) => void togglePick(point)}
        onDistrictClick={showDistrict}
        onAreaDrawn={(shape) => void saveArea(shape)}
        goTo={placeView?.goTo ?? null}
        placeMarker={placeView?.marker ?? null}
        onUserPan={() => setPlaceView((current) => (current && current.marker ? { ...current, marker: null } : current))}
        tools={tools}
        toolsBesidePanel={!empty}
      >
        {notices ? (
          <div className={cn("absolute left-[3.75rem] right-3 top-[3.75rem] z-10 flex flex-col items-start gap-2", BESIDE_MAP_PANEL)}>
            {shownFocusProblem ? (
              <p role="status" className={cn(MAP_NOTICE, "flex items-center gap-2")}>
                <span>{shownFocusProblem.reason === "unplaced" ? t("focus.unplaced") : t("focus.failed")}</span>
                <button
                  type="button"
                  onClick={clearFocus}
                  aria-label={t("focus.dismiss")}
                  className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </p>
            ) : null}
            {viewportFailed ? (
              <RetryNotice
                className={MAP_NOTICE}
                message={viewportFailure}
                retryLabel={tCommon("retry")}
                retrying={viewport.isFetching}
                onRetry={() => void viewport.refetch()}
              />
            ) : null}
            {layerFailed ? (
              <RetryNotice
                className={MAP_NOTICE}
                message={isBusySectionError(layer.error) ? tCommon("sectionBusy") : t("layerFailed")}
                retryLabel={tCommon("retry")}
                retrying={layer.isFetching}
                onRetry={() => void layer.refetch()}
              />
            ) : null}
          </div>
        ) : null}

        {empty ? null : (
          <MapLegend
            className="absolute bottom-3 left-3 z-10 w-[250px] max-sm:bottom-16"
            mode={mode}
            coloured={colourField !== undefined}
            districtsCount={mode === "districts" ? (districts.data ?? []).reduce((sum, district) => sum + district.count, 0) : null}
            approximateCount={mode === "points" ? visible?.approximate ?? 0 : 0}
            selectedCount={pickedIds.length > 0 ? pickedIds.length : undefined}
            showArea={outlined.length > 0}
            credit={t("legend.ibgeCredit")}
          />
        )}

        {peek ? (
          <LeadMapPeek
            point={peek.point}
            params={params}
            placement={peek.placement}
            classification={colourField ?? classification}
            onClose={closePeek}
          />
        ) : null}

        {empty ? null : (
          <GeoSummaryPanel
            summary={summary.data ?? null}
            areaNames={activeAreas.map((area) => area.name)}
            colour={panelColour}
            failed={summary.isError}
            busy={isBusySectionError(summary.error)}
            onRetry={() => void summary.refetch()}
            retrying={summary.isFetching}
            offMapActions={offMapActions}
            leftOut={leftOutView}
          >
            <DistrictList
              districts={districts.data ?? null}
              activeKey={focus?.district ?? null}
              failed={districts.isError}
              onRetry={() => void districts.refetch()}
              retrying={districts.isFetching}
              onActivate={showDistrict}
              onSelectAll={(district) => onFilterChange(withDistrictPairs(filter, [district.pair]))}
              onRadius={saveRadius}
            />
          </GeoSummaryPanel>
        )}
      </LeadMap>
    );

  return (
    <div className={cn("flex flex-col", className)}>
      <div ref={attachFrame} className="relative h-[520px] w-full overflow-hidden max-sm:h-[70vh]">
        {body}
        {empty && availability !== "unavailable" ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
            <MapEmptyState
              className={cn("pointer-events-auto h-auto max-h-full w-full max-w-2xl overflow-y-auto py-6", MAP_FLOATY)}
              summary={summary.data ?? null}
              importAddresses={canCreateLead ? { onSelect: onImport } : { disabledReason: t("empty.reasons.importForbidden") }}
              requestAddress={requestAddress}
              createLead={canCreateLead ? { onSelect: onCreateLead } : { disabledReason: t("empty.reasons.importForbidden") }}
            />
          </div>
        ) : null}
      </div>
      <MapSummary
        summary={summary.data ?? null}
        visibleCount={visible?.onMap ?? null}
        visibleApproximate={visible?.approximate ?? null}
        loading={summary.isPending}
        failed={summary.isError}
      />
      {selectionBar({ total: summary.data?.total ?? null, inArea: activeAreas.length > 0 })}
      {requesting ? (
        <LeadSendDialog
          action="send_template"
          selection={addressRequestSelection(filter, search)}
          size={withoutAddressCount}
          onClose={() => setRequesting(false)}
        />
      ) : null}
    </div>
  );
}
