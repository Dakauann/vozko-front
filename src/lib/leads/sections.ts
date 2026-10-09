import { encodeFilterParam, type CrmFilter } from '@/lib/crm/board';
import { leadsQueryString } from '@/lib/leads/query';

export type LeadSection = 'summary' | 'facets' | 'places';

export interface LeadSummarySection {
    total: number;
    withAddress: number;
    onMap: number;
    approximate: number;
    withoutAddress: number;
    birthdaysToday: number;
    blocked: number;
    windowOpen: number;
}

export interface LeadOwnerCount {
    owner: string;
    name?: string;
    count: number;
}

export interface LeadClassificationFacet {
    key: string;
    values: Record<string, number>;
}

export interface LeadFacetsSection {
    channels: Record<string, number>;
    memoryCategories: Record<string, number>;
    campaignStatuses: Record<string, number>;
    sources: Record<string, number>;
    owners: LeadOwnerCount[];
    ownersTruncated: boolean;
    classification?: LeadClassificationFacet;
}

export interface LeadCityCount {
    cityKey: string;
    city: string;
    state: string;
    count: number;
}

export interface LeadDistrictCount {
    pair: string;
    cityKey: string;
    districtKey: string;
    district: string;
    city: string;
    state: string;
    count: number;
}

export interface LeadPlacesSection {
    cities: LeadCityCount[];
    districts: LeadDistrictCount[];
}

export interface LeadSectionPayloads {
    summary: LeadSummarySection;
    facets: LeadFacetsSection;
    places: LeadPlacesSection;
}

export interface LeadSectionParams {
    filter: CrmFilter;
    q?: string;
    place?: string;
    colorBy?: string;
}

export { SectionError as LeadSectionError } from '@/lib/analytics/section-query';

export function leadSectionPath(section: LeadSection, params: LeadSectionParams): string {
    const query = new URLSearchParams(leadsQueryString({ filter: params.filter, q: params.q }));
    const place = params.place?.trim();
    if (place) query.set('place', place);
    const colorBy = params.colorBy?.trim();
    if (colorBy) query.set('colorBy', colorBy);
    const encoded = query.toString();
    return `/leads/sections/${section}${encoded ? `?${encoded}` : ''}`;
}

export function leadSectionsKey(workspaceId: string) {
    return ['lead-section', workspaceId] as const;
}

export function leadSectionKey(workspaceId: string, section: LeadSection, params: LeadSectionParams) {
    return [
        ...leadSectionsKey(workspaceId),
        section,
        encodeFilterParam(params.filter),
        params.q?.trim() ?? '',
        params.place?.trim() ?? '',
        params.colorBy?.trim() ?? '',
    ] as const;
}

const SECTION_IDENTITY_PARTS = 3;

export function isSameLeadSection(previous: readonly unknown[], next: readonly unknown[]): boolean {
    return previous.length === next.length
        && previous.slice(0, SECTION_IDENTITY_PARTS).every((part, index) => part === next[index]);
}
