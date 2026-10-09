import { encodeFilterParam } from '@/lib/crm/board';
import type { LeadsQueryParams } from '@/lib/leads/types';

export function leadsQueryString(params: LeadsQueryParams): string {
    const qs = new URLSearchParams();

    const filter = encodeFilterParam(params.filter);
    if (filter) qs.set('filter', filter);

    const q = params.q?.trim();
    if (q) qs.set('q', q);

    if (params.sorts?.length) {
        qs.set('sort', params.sorts.map((s) => `${s.key}:${s.direction}`).join(','));
    }
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    return qs.toString();
}
