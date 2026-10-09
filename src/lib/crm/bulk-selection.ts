import {
    isEmptyCrmFilter,
    type CrmBulkActionType,
    type CrmBulkCount,
    type CrmBulkInput,
    type CrmBulkTarget,
    type CrmFilter,
} from './board';

export type CrmBulkSelection =
    | { kind: 'ids'; targets: CrmBulkTarget[] }
    | { kind: 'filter'; mode: 'all_matching' | 'everyone'; filter: CrmFilter; count: CrmBulkCount };

export function filterSelection(
    filter: CrmFilter,
    count: CrmBulkCount,
): Extract<CrmBulkSelection, { kind: 'filter' }> {
    return {
        kind: 'filter',
        mode: isEmptyCrmFilter(filter) ? 'everyone' : 'all_matching',
        filter,
        count,
    };
}

export function bulkSelectionSize(selection: CrmBulkSelection): number {
    return selection.kind === 'ids' ? selection.targets.length : selection.count.matched;
}

export function bulkRequest(
    action: CrmBulkActionType,
    value: string,
    selection: CrmBulkSelection,
): CrmBulkInput {
    if (selection.kind === 'ids') {
        return { action, value, mode: 'ids', targets: selection.targets };
    }
    const confirmed = {
        expectedCount: selection.count.matched,
        fingerprint: selection.count.fingerprint,
    };
    if (selection.mode === 'everyone') {
        return { action, value, mode: 'everyone', ...confirmed };
    }
    return { action, value, mode: 'all_matching', filter: selection.filter, ...confirmed };
}
