import {
    LEAD_FILTER_FIELD,
    readBoolean,
    readSet,
    withBoolean,
    withSet,
    type LeadFilter,
} from '@/lib/leads/filters';
import type { LeadSummarySection } from '@/lib/leads/sections';

export const LEAD_SUMMARY_TILES = [
    'total',
    'onMap',
    'approximate',
    'withoutAddress',
    'birthdaysToday',
    'blocked',
    'windowOpen',
] as const satisfies readonly (keyof LeadSummarySection)[];

export type LeadSummaryTileId = (typeof LEAD_SUMMARY_TILES)[number];

export interface LeadSummaryTile {
    id: LeadSummaryTileId;
    count: number;
    interactive: boolean;
    applied: boolean;
}

interface TileFilter {
    applied: (filter: LeadFilter) => boolean;
    apply: (filter: LeadFilter) => LeadFilter;
    clear: (filter: LeadFilter) => LeadFilter;
}

function sameValues(current: readonly string[], expected: readonly string[]): boolean {
    return current.length === expected.length && expected.every((value) => current.includes(value));
}

function setTile(field: string, values: string[]): TileFilter {
    return {
        applied: (filter) => sameValues(readSet(filter, field), values),
        apply: (filter) => withSet(filter, field, values),
        clear: (filter) => withSet(filter, field, []),
    };
}

function booleanTile(field: string, value: boolean): TileFilter {
    return {
        applied: (filter) => readBoolean(filter, field) === value,
        apply: (filter) => withBoolean(filter, field, value),
        clear: (filter) => withBoolean(filter, field, null),
    };
}

const PLACEMENT_TILES: Partial<Record<LeadSummaryTileId, TileFilter>> = {
    onMap: setTile(LEAD_FILTER_FIELD.geoPlacement, ['on_map']),
    approximate: setTile(LEAD_FILTER_FIELD.geoPlacement, ['approximate']),
};

const TILE_FILTERS: Partial<Record<LeadSummaryTileId, TileFilter>> = {
    ...PLACEMENT_TILES,
    withoutAddress: booleanTile(LEAD_FILTER_FIELD.hasAddress, false),
    birthdaysToday: setTile(LEAD_FILTER_FIELD.birthday, ['today']),
    blocked: booleanTile(LEAD_FILTER_FIELD.blocked, true),
    windowOpen: booleanTile(LEAD_FILTER_FIELD.windowOpen, true),
};

export interface SummaryTileViewer {
    readsAddresses: boolean;
}

function tileFilterFor(id: LeadSummaryTileId, viewer: SummaryTileViewer): TileFilter | undefined {
    if (PLACEMENT_TILES[id] && !viewer.readsAddresses) return undefined;
    return TILE_FILTERS[id];
}

export function summaryTiles(summary: LeadSummarySection, filter: LeadFilter, viewer: SummaryTileViewer): LeadSummaryTile[] {
    return LEAD_SUMMARY_TILES.flatMap((id) => {
        const tileFilter = tileFilterFor(id, viewer);
        const applied = tileFilter?.applied(filter) ?? false;
        const count = summary[id] ?? 0;
        if (id !== 'total' && count === 0 && !applied) return [];
        return [{ id, count, interactive: !!tileFilter, applied }];
    });
}

export function toggleSummaryTile(filter: LeadFilter, id: LeadSummaryTileId): LeadFilter {
    const tileFilter = TILE_FILTERS[id];
    if (!tileFilter) return filter;
    return tileFilter.applied(filter) ? tileFilter.clear(filter) : tileFilter.apply(filter);
}
