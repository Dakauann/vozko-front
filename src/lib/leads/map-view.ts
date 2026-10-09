import { sectionErrorCode } from '@/lib/analytics/section-query';
import { crmFilterFromValue, encodeFilterParam, type CrmFilter } from '@/lib/crm/board';
import { optionTone, type CustomFieldDefinition } from '@/lib/crm/custom-fields';
import { effectiveLeadFilter } from '@/lib/leads/bulk-selection';
import type { LeadSelection } from '@/lib/leads/actions';
import { primaryAddress } from '@/lib/leads/detail';
import { LEAD_FILTER_FIELD, readSet, withBoolean, withSet, type LeadGeoPlacement } from '@/lib/leads/filters';
import { leadsQueryString } from '@/lib/leads/query';
import type { LeadAddress, LeadRecord } from '@/lib/leads/types';
import { MapContractError, parseLeftOutCounts, parsePointPeople, type PointPeople } from '@/lib/maps/contracts';
import { isValidPosition } from '@/lib/maps/geometry';
import { type ColourLegendRow, type OffMapKey } from '@/lib/maps/summary';
import { screenPaths } from '@/lib/navigation/routes';
import { precisionCategory } from '@/lib/maps/precision';
import { MAP_LAYER_MODES, type BBox, type DistrictCount, type GeoSummary, type LatLng, type LeftOutDistrict, type MapLayerMode, type MapLayerResponse, type MapPlacement, type MapPoint, type MapSpot, type MapView, type Precision, type SnappedViewport } from '@/lib/maps/types';
import { formatCep } from '@/lib/address/cep';

export { offMapRows, type ColourLegendRow, type OffMapKey, type OffMapRow } from '@/lib/maps/summary';

export const LEAD_VIEWS = ['table', 'map'] as const;

export type LeadView = (typeof LEAD_VIEWS)[number];

export type LeadMapSection = 'summary' | 'districts' | 'viewport' | 'layer' | 'point' | 'left-out';

export interface LeadMapParams {
    filter: CrmFilter;
    q?: string;
}

export interface LeadMapLayerRequest {
    viewport: SnappedViewport;
    colorBy?: string;
}

function withParams(path: string, params: LeadMapParams, extra: Record<string, string> = {}): string {
    const query = new URLSearchParams(leadsQueryString({ filter: params.filter, q: params.q }));
    for (const [key, value] of Object.entries(extra)) {
        if (value !== '') query.set(key, value);
    }
    const text = query.toString();
    return text ? `${path}?${text}` : path;
}

export function bboxParam(bbox: BBox): string {
    return [bbox.west, bbox.south, bbox.east, bbox.north].join(',');
}

export function leadMapSectionPath(section: 'summary' | 'districts' | 'viewport' | 'left-out', params: LeadMapParams): string {
    return withParams(`/leads/map/${section}`, params);
}

export function leadMapLayerPath(params: LeadMapParams, request: LeadMapLayerRequest): string {
    return withParams('/leads/map/layer', params, {
        bbox: bboxParam(request.viewport.bbox),
        zoom: String(request.viewport.zoom),
        colorBy: request.colorBy ?? '',
    });
}

export function leadMapPointPath(params: LeadMapParams, at: MapSpot): string {
    return withParams('/leads/map/point', params, { lat: String(at.lat), lng: String(at.lng), placement: at.placement });
}

export const LEAD_MAP_FOCUS_PARAM = 'focus';

export const LEAD_MAP_VIEW_PARAMS: readonly string[] = [LEAD_MAP_FOCUS_PARAM];

export function leadMapHref(leadId: string): string {
    const view: LeadView = 'map';
    const query = new URLSearchParams({ view, [LEAD_MAP_FOCUS_PARAM]: leadId });
    return `${screenPaths.leads}?${query.toString()}`;
}

export interface LeadMapSearchParams {
    get(name: string): string | null;
    toString(): string;
}

export function leadMapFocusOf(params: Pick<LeadMapSearchParams, 'get'>): string | null {
    const leadId = params.get(LEAD_MAP_FOCUS_PARAM)?.trim() ?? '';
    return leadId === '' ? null : leadId;
}

export function withoutLeadMapFocus(params: Pick<LeadMapSearchParams, 'toString'>): string {
    const next = new URLSearchParams(params.toString());
    next.delete(LEAD_MAP_FOCUS_PARAM);
    return next.toString();
}

export function leadMapsKey(workspaceId: string) {
    return ['lead-map', workspaceId] as const;
}

export function leadMapKey(workspaceId: string, section: LeadMapSection, params: LeadMapParams, ...extra: string[]) {
    return [...leadMapsKey(workspaceId), section, encodeFilterParam(params.filter), params.q?.trim() ?? '', ...extra] as const;
}

const MAP_SECTION_IDENTITY_PARTS = 5;

export function isSameLeadMapSection(previous: readonly unknown[], next: readonly unknown[]): boolean {
    return previous.length === next.length
        && previous.slice(0, MAP_SECTION_IDENTITY_PARTS).every((part, index) => part === next[index]);
}

export type LeadMapAvailability = 'ready' | 'unavailable';

const UNAVAILABLE_CODES = new Set(['lead_map_unavailable', 'lead_areas_unavailable']);

export function leadMapAvailability(error: unknown): LeadMapAvailability {
    const code = sectionErrorCode(error);
    if (code && UNAVAILABLE_CODES.has(code)) return 'unavailable';
    return 'ready';
}

export function areaIdsOf(filter: CrmFilter): string[] {
    return readSet(filter, LEAD_FILTER_FIELD.area);
}

export function withDrawnArea(filter: CrmFilter, areaId: string): CrmFilter {
    const current = areaIdsOf(filter);
    if (current.includes(areaId)) return filter;
    return withSet(filter, LEAD_FILTER_FIELD.area, [...current, areaId]);
}

export function withoutArea(filter: CrmFilter, areaId: string): CrmFilter {
    const current = areaIdsOf(filter);
    if (!current.includes(areaId)) return filter;
    return withSet(filter, LEAD_FILTER_FIELD.area, current.filter((id) => id !== areaId));
}

export function withDistrictPairs(filter: CrmFilter, pairs: readonly string[]): CrmFilter {
    const current = readSet(filter, LEAD_FILTER_FIELD.district);
    const added = pairs.filter((pair, index) => !current.includes(pair) && pairs.indexOf(pair) === index);
    return withSet(filter, LEAD_FILTER_FIELD.district, [...current, ...added]);
}

export function withoutAddressFilter(filter: CrmFilter): CrmFilter {
    return withBoolean(filter, LEAD_FILTER_FIELD.hasAddress, false);
}

const OFF_MAP_PLACEMENTS: Record<Exclude<OffMapKey, 'withoutAddress'>, LeadGeoPlacement> = {
    approximate: 'approximate',
    notFound: 'not_found',
    pending: 'pending',
    quotaExceeded: 'quota_exceeded',
    refused: 'refused',
};

export function offMapFilter(filter: CrmFilter, key: OffMapKey): CrmFilter {
    if (key === 'withoutAddress') return withoutAddressFilter(filter);
    return withSet(filter, LEAD_FILTER_FIELD.geoPlacement, [OFF_MAP_PLACEMENTS[key]]);
}

export function addressRequestSelection(filter: CrmFilter, search: string): LeadSelection {
    return { mode: 'all_matching', filter: withoutAddressFilter(effectiveLeadFilter(filter, search)) };
}

export interface MapLeftOut {
    total: number;
    filter: CrmFilter | null;
    districts: LeftOutDistrict[];
}

const IMPLIED_CONJUNCTION = 'or';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withImpliedConjunctions(value: unknown): unknown {
    if (!isObject(value) || !Array.isArray(value.groups)) return value;
    const groups = value.groups.map((group) =>
        isObject(group) && group.conjunction === undefined ? { ...group, conjunction: IMPLIED_CONJUNCTION } : group,
    );
    return { ...value, groups };
}

function leftOutFilter(value: unknown): CrmFilter | null {
    if (value === undefined || value === null) return null;
    const filter = crmFilterFromValue(withImpliedConjunctions(value));
    if (!filter) throw new MapContractError('left out filter is malformed');
    return filter;
}

export function parseMapLeftOut(value: unknown): MapLeftOut {
    const counts = parseLeftOutCounts(value);
    return { total: counts.total, filter: leftOutFilter(counts.filter), districts: counts.districts };
}

export function leftOutListFilter(leftOut: MapLeftOut, pair?: string): CrmFilter | null {
    if (!leftOut.filter) return null;
    return pair ? withSet(leftOut.filter, LEAD_FILTER_FIELD.district, [pair]) : leftOut.filter;
}

export interface VisibleCounts {
    onMap: number;
    approximate: number;
}

export function visibleByPlacement(layer: MapLayerResponse | null): VisibleCounts | null {
    if (!layer) return null;
    const counts: VisibleCounts = { onMap: 0, approximate: 0 };
    const items = layer.kind === 'points' ? layer.points : layer.cells;
    for (const item of items) {
        if (item.placement === 'on_map') counts.onMap += item.count;
        else counts.approximate += item.count;
    }
    return counts;
}

export function nothingOnMap(summary: GeoSummary | null, districts: readonly DistrictCount[] | null): boolean {
    if (!summary || !districts) return false;
    return summary.onMap === 0 && districts.length === 0;
}

export const LEAD_MAP_LAYER_PARAM = 'layer';

export const LEAD_MAP_COLOR_PARAM = 'color';

export const NO_COLOUR = 'none';

export function leadMapLayerOf(params: Pick<LeadMapSearchParams, 'get'>): MapLayerMode | null {
    const value = params.get(LEAD_MAP_LAYER_PARAM);
    return (MAP_LAYER_MODES as readonly string[]).includes(value ?? '') ? (value as MapLayerMode) : null;
}

export function leadMapColorOf(params: Pick<LeadMapSearchParams, 'get'>): string | null {
    const value = params.get(LEAD_MAP_COLOR_PARAM)?.trim() ?? '';
    return value === '' ? null : value;
}

export function withLeadMapParam(params: Pick<LeadMapSearchParams, 'toString'>, name: string, value: string): string {
    const next = new URLSearchParams(params.toString());
    next.set(name, value);
    return next.toString();
}

export function defaultLayerMode(view: MapView | undefined, kind: MapLayerResponse['kind'] | null): MapLayerMode {
    if (view === 'districts') return 'districts';
    return kind === 'cells' ? 'heat' : 'points';
}

export function colourFieldsOf(fields: readonly CustomFieldDefinition[]): CustomFieldDefinition[] {
    return fields
        .filter((field) => field.objectType === 'lead' && field.type === 'select' && field.readable === true)
        .sort((a, b) => a.position - b.position);
}

export function chosenColourField(fields: readonly CustomFieldDefinition[], chosen: string | null): CustomFieldDefinition | undefined {
    const offered = colourFieldsOf(fields);
    if (chosen === NO_COLOUR) return undefined;
    if (chosen === null) return offered.find((field) => field.role === 'classification');
    return offered.find((field) => field.key === chosen);
}

function addressPart(value: string | undefined): string {
    return (value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function fullAddressKey(lead: Pick<LeadRecord, 'addresses'>): string | null {
    const address = primaryAddress(lead.addresses);
    if (!address || addressPart(address.street) === '' || addressPart(address.number) === '') return null;
    return [address.street, address.number, address.complement, address.district, address.city, address.state].map(addressPart).join('|');
}

export function sameFullAddress(leads: ReadonlyArray<Pick<LeadRecord, 'addresses'>>): boolean {
    const keys = leads.map(fullAddressKey);
    return keys.length > 0 && keys[0] !== null && keys.every((key) => key === keys[0]);
}

export function colourLegend(
    field: CustomFieldDefinition,
    values: Readonly<Record<string, number>> | undefined,
    total: number,
): ColourLegendRow[] {
    const counts = values ?? {};
    const rows: ColourLegendRow[] = (field.options ?? []).map((option) => ({
        key: option,
        label: option,
        count: counts[option] ?? 0,
        tone: optionTone(field, option) ?? 'neutral',
    }));
    const informed = rows.reduce((sum, row) => sum + row.count, 0);
    rows.push({ key: '', label: null, count: Math.max(0, total - informed), tone: 'neutral' });
    return rows;
}

export type MapPeek = PointPeople<LeadRecord>;

export function parseMapPeek(value: unknown): MapPeek {
    return parsePointPeople<LeadRecord>(value);
}

const PEEK_GAP = 12;

export interface Size {
    width: number;
    height: number;
}

export function peekPlacement(at: { x: number; y: number }, container: Size, peek: Size): { left: number; top: number } {
    const fitsRight = at.x + PEEK_GAP + peek.width <= container.width - PEEK_GAP;
    const left = fitsRight ? at.x + PEEK_GAP : Math.max(PEEK_GAP, at.x - PEEK_GAP - peek.width);
    const top = Math.min(Math.max(PEEK_GAP, at.y - PEEK_GAP), Math.max(PEEK_GAP, container.height - PEEK_GAP - peek.height));
    return { left, top };
}

export function centeredPeek(container: Size, peek: Size): { left: number; top: number } {
    return {
        left: Math.max(PEEK_GAP, Math.round((container.width - peek.width) / 2)),
        top: Math.max(PEEK_GAP, Math.round((container.height - peek.height) / 2)),
    };
}

export type MapPicks = Readonly<Record<string, readonly string[]>>;

export function withPick(picks: MapPicks, pointId: string, leadIds: readonly string[]): MapPicks {
    if (leadIds.length === 0) return picks;
    return { ...picks, [pointId]: [...leadIds] };
}

export function withoutPick(picks: MapPicks, pointId: string): MapPicks {
    const next = { ...picks };
    delete next[pointId];
    return next;
}

export function pickedLeadIds(picks: MapPicks): string[] {
    return [...new Set(Object.values(picks).flat())];
}

const POINT_FRAME_DEGREES = 0.01;

export function pointBounds(point: LatLng): BBox {
    return {
        south: point.lat - POINT_FRAME_DEGREES,
        north: point.lat + POINT_FRAME_DEGREES,
        west: point.lng - POINT_FRAME_DEGREES,
        east: point.lng + POINT_FRAME_DEGREES,
    };
}

export interface AddressPosition extends LatLng {
    precision?: Precision;
}

export function addressPosition(address: LeadAddress): AddressPosition | null {
    const { latitude: lat, longitude: lng } = address;
    const located = typeof lat === 'number' && typeof lng === 'number' && isValidPosition({ lat, lng });
    return located ? { lat, lng, ...(address.precision ? { precision: address.precision } : {}) } : null;
}

const FOCUS_TONE = 'neutral' as const;

export function pointId(at: LatLng, placement: MapPlacement): string {
    const position = `${at.lat},${at.lng}`;
    return placement === 'approximate' ? `approximate:${position}` : position;
}

export function focusPoint(lead: Pick<LeadRecord, 'id' | 'addresses'>): MapPoint | null {
    const address = primaryAddress(lead.addresses);
    const position = address ? addressPosition(address) : null;
    if (!address || !position || !address.precision) return null;
    const placement: MapPlacement = precisionCategory(address.precision) === 'house' ? 'on_map' : 'approximate';
    return {
        id: pointId(position, placement),
        lat: position.lat,
        lng: position.lng,
        precision: address.precision,
        placement,
        tone: FOCUS_TONE,
        count: 1,
        leadIds: [lead.id],
    };
}

export type ApproximatePlaceKind = 'postal_code' | 'district' | 'city';

export interface ApproximatePlace {
    kind: ApproximatePlaceKind;
    name: string | null;
}

function named(value: string | undefined): string | null {
    const text = value?.trim() ?? '';
    return text === '' ? null : text;
}

export function approximatePlace(
    address: Pick<LeadAddress, 'precision' | 'zipCode' | 'district' | 'city'> | undefined,
): ApproximatePlace | null {
    switch (address?.precision) {
        case 'postal_code': {
            const zip = named(address.zipCode);
            return { kind: 'postal_code', name: zip ? formatCep(zip) : null };
        }
        case 'district':
            return { kind: 'district', name: named(address.district) };
        case 'city':
            return { kind: 'city', name: named(address.city) };
        default:
            return null;
    }
}

export function addressPositions(addresses: readonly LeadAddress[] | undefined): Record<string, AddressPosition | null> {
    const positions: Record<string, AddressPosition | null> = {};
    for (const address of addresses ?? []) positions[address.id] = addressPosition(address);
    return positions;
}
