
import {
    hasFilterPredicate,
    readFilterValues,
    removeFilterPredicate,
    withFilterPredicate,
    type CrmFilter,
} from '@/lib/crm/board';

export function readText(filter: CrmFilter, field: string): string {
    return readFilterValues(filter, field, 'contains')[0] ?? '';
}

export function withText(
    filter: CrmFilter,
    field: string,
    value: string,
): CrmFilter {
    const trimmed = value.trim();
    return withFilterPredicate(filter, field, 'contains', trimmed ? [trimmed] : []);
}

export function readSet(filter: CrmFilter, field: string): string[] {
    return readFilterValues(filter, field, 'in');
}

export function withSet(
    filter: CrmFilter,
    field: string,
    values: string[],
): CrmFilter {
    return withFilterPredicate(filter, field, 'in', values);
}

export function toggleInSet(
    filter: CrmFilter,
    field: string,
    value: string,
): CrmFilter {
    const current = readSet(filter, field);
    return withSet(
        filter,
        field,
        current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value],
    );
}

export type RangeBound = 'gte' | 'lte';

export function readBound(
    filter: CrmFilter,
    field: string,
    bound: RangeBound,
): string {
    return readFilterValues(filter, field, bound)[0] ?? '';
}

export function withBound(
    filter: CrmFilter,
    field: string,
    bound: RangeBound,
    value: string,
): CrmFilter {
    const trimmed = value.trim();
    return withFilterPredicate(filter, field, bound, trimmed ? [trimmed] : []);
}

export function readBoolean(filter: CrmFilter, field: string): boolean | null {
    if (hasFilterPredicate(filter, field, 'is_true')) return true;
    if (hasFilterPredicate(filter, field, 'is_false')) return false;
    return null;
}

export function withBoolean(
    filter: CrmFilter,
    field: string,
    value: boolean | null,
): CrmFilter {
    const cleared = removeFilterPredicate(
        removeFilterPredicate(filter, field, 'is_true'),
        field,
        'is_false',
    );
    if (value === null) return cleared;
    return withFilterPredicate(cleared, field, value ? 'is_true' : 'is_false', [], {
        valueless: true,
    });
}

export function readPresence(filter: CrmFilter, field: string): boolean | null {
    if (hasFilterPredicate(filter, field, 'is_set')) return true;
    if (hasFilterPredicate(filter, field, 'is_empty')) return false;
    return null;
}

export function withPresence(
    filter: CrmFilter,
    field: string,
    value: boolean | null,
): CrmFilter {
    const cleared = removeFilterPredicate(
        removeFilterPredicate(filter, field, 'is_set'),
        field,
        'is_empty',
    );
    if (value === null) return cleared;
    return withFilterPredicate(cleared, field, value ? 'is_set' : 'is_empty', [], {
        valueless: true,
    });
}

