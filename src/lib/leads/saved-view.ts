import type { SavedView, SavedViewInput } from '@/lib/crm/saved-views';
import { emptyLeadFilter, type LeadFilter } from '@/lib/leads/filters';
import type { LeadSort, LeadSortKey } from '@/lib/leads/types';

export interface LeadViewState<C extends string> {
    filter: LeadFilter;
    sort?: LeadSort;
    columns: C[];
}

export function savedViewState<C extends string>(
    view: SavedView,
    sortKeys: readonly LeadSortKey[],
    isColumn: (column: string) => column is C,
): LeadViewState<C> {
    const sortKey = sortKeys.find((key) => key === view.sortField);
    return {
        filter: view.filter ?? emptyLeadFilter,
        ...(sortKey ? { sort: { key: sortKey, direction: view.sortDir === 'asc' ? 'asc' : 'desc' } } : {}),
        columns: (view.columns ?? []).filter(isColumn),
    };
}

export function leadSavedViewInput({
    name,
    filter,
    sorts,
    columns,
}: {
    name: string;
    filter: LeadFilter;
    sorts: readonly LeadSort[];
    columns: readonly string[];
}): SavedViewInput {
    return {
        name: name.trim(),
        objectType: 'lead',
        filter,
        groupBy: 'none',
        sortField: sorts[0]?.key,
        sortDir: sorts[0]?.direction,
        columns: [...columns],
        visibility: 'private',
    };
}
