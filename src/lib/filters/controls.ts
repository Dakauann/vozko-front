/**
 * Control-level reads and writes over a CrmFilter.
 *
 * A filter bar is a set of controls that each own one (field, operator) pair.
 * These helpers name the intent — "set the age floor", "clear the blocked
 * question" — so no control has to restate the operator convention, and every
 * list that adopts the filter model gets the same semantics for free.
 *
 * Object-agnostic on purpose: leads use them today, and the conversation and
 * opportunity bars can adopt them without a second implementation.
 */

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

/** The two edges of a range control. */
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

/**
 * Tri-state booleans. `null` means "no opinion", which is NOT the same as
 * false: filtering `blocked=false` hides nothing by default, but a control that
 * defaulted to false would silently hide every blocked lead.
 */
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

/** Presence: has any / has none / no opinion. */
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

