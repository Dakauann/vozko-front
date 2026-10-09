import type {
    AnalysisListParams,
    CreatedLead,
    LeadRelation,
    LeadRelationKind,
    LeadRelativesPage,
    AnalysisListResponse,
    EntryConversationResponse,
    Lead,
    LeadAnalysis,
    LeadAnonymizeOutcome,
    LeadAreaInput,
    LeadBlockOutcome,
    LeadCard,
    LeadDetail,
    LeadOptOutSource,
    LeadRecord,
    ConversationEntryType,
    LeadListItem,
    LeadSortKey,
    LeadsListMeta,
    LeadsQueryParams,
    OldLeadsListParams,
} from '@/lib/leads/types';

import { emptyCrmFilter } from '@/lib/crm/board';
import { withText } from '@/lib/filters/controls';
import { leadsQueryString } from '@/lib/leads/query';
import { requireSectionData } from '@/lib/analytics/section-query';
import {
    leadSectionPath,
    type LeadSection,
    type LeadSectionParams,
    type LeadSectionPayloads,
} from '@/lib/leads/sections';

import { apiClient } from "@/lib/api/browser-client";
import { codedErrorOf, codedRefusalOf, type CodedError, type CodedRefusal } from "@/lib/api/coded-error";
import { ifMatchHeader, isVersionConflict, type VersionedSaveResult } from "@/lib/api/versioned-save";
import { readDealsPage, readTimelinePage, type LeadDealsPage, type LeadTimelinePage } from '@/lib/leads/timeline';
import { readLeadSummary, type LeadDetailSummary } from '@/lib/leads/detail-summary';
import type { CreateLeadBody, UpdateLeadBody } from '@/lib/leads/sheet';

const DEFAULT_LEADS_META: LeadsListMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listLeadsAction(params: OldLeadsListParams = {}) {
    let filter = emptyCrmFilter;
    if (params.number) filter = withText(filter, 'number', params.number);
    if (params.name) filter = withText(filter, 'name', params.name);

    const result = await listLeadsQueryAction({
        filter,
        sorts: params.sort
            ? [{ key: params.sort as LeadSortKey, direction: params.order ?? 'desc' }]
            : undefined,
        page: params.page,
        pageSize: params.pageSize,
    });

    return {
        leads: result.items as Lead[],
        meta: result.meta,
        error: result.error,
    };
}

const EMPTY_ANSWER: CodedError = { message: 'Empty response' };

function hasVersion(value: unknown): value is { version: number } {
    if (typeof value !== 'object' || value === null) return false;
    const version = (value as { version?: unknown }).version;
    return typeof version === 'number' && Number.isInteger(version) && version >= 1;
}

function isLeadRecord(value: unknown): value is LeadRecord {
    return hasVersion(value) && typeof (value as { id?: unknown }).id === 'string';
}

function leadPath(leadId: string): string {
    return `/leads/${encodeURIComponent(leadId)}`;
}

export type LeadRefusal = CodedRefusal;

export type LeadSaveResult = VersionedSaveResult<'lead', LeadRecord, LeadRefusal>;

async function saveLeadRecord(
    method: 'PATCH' | 'PUT',
    leadId: string,
    version: number | undefined,
    body: Record<string, unknown>,
): Promise<LeadSaveResult> {
    const response = await apiClient<LeadRecord>(leadPath(leadId), {
        method,
        headers: ifMatchHeader(version),
        body: JSON.stringify(body),
    });

    if (response.error) {
        const { error } = response;
        if (isVersionConflict(error) && isLeadRecord(error.current)) {
            return { status: 'conflict', current: error.current };
        }
        return { status: 'failed', error: codedRefusalOf(error) };
    }
    if (!isLeadRecord(response.data)) return { status: 'failed', error: EMPTY_ANSWER };
    return { status: 'saved', lead: response.data };
}

export async function updateLeadAction(
    leadId: string,
    version: number,
    body: UpdateLeadBody,
): Promise<LeadSaveResult> {
    return saveLeadRecord('PUT', leadId, version, { ...body });
}

export type LeadCreateResult =
    | { lead: CreatedLead; error: null }
    | { lead: null; error: LeadRefusal };

function isCreatedLead(value: unknown): value is CreatedLead {
    return isLeadRecord(value) && Array.isArray((value as { duplicates?: unknown }).duplicates);
}

export async function createLeadAction(body: CreateLeadBody): Promise<LeadCreateResult> {
    const response = await apiClient<CreatedLead>('/leads', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (response.error) return { lead: null, error: codedRefusalOf(response.error) };
    if (!isCreatedLead(response.data)) return { lead: null, error: EMPTY_ANSWER };
    return { lead: response.data, error: null };
}

export type LeadCommandResult =
    | { lead: LeadRecord; error: null }
    | { lead: null; error: LeadRefusal };

async function postLeadCommand(leadId: string, command: string, body?: Record<string, unknown>): Promise<LeadCommandResult> {
    const response = await apiClient<LeadRecord>(`${leadPath(leadId)}/${command}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.error) return { lead: null, error: codedRefusalOf(response.error) };
    if (!isLeadRecord(response.data)) return { lead: null, error: EMPTY_ANSWER };
    return { lead: response.data, error: null };
}

export async function setLeadOwnerAction(leadId: string, ownerId: string): Promise<LeadCommandResult> {
    return postLeadCommand(leadId, 'owner', { ownerId });
}

export async function optOutLeadAction(leadId: string, source: LeadOptOutSource): Promise<LeadCommandResult> {
    return postLeadCommand(leadId, 'opt-out', { source });
}

export async function setLeadDistrictAction(leadId: string, area: LeadAreaInput): Promise<LeadCommandResult> {
    return postLeadCommand(leadId, 'district', {
        district: area.district,
        city: area.city,
        state: area.state,
        ...(area.cityCode ? { cityCode: area.cityCode } : {}),
    });
}

export async function pinLeadAddressAction(
    leadId: string,
    addressId: string,
    position: { lat: number; lng: number },
): Promise<LeadCommandResult> {
    return postLeadCommand(leadId, `addresses/${encodeURIComponent(addressId)}/pin`, { latitude: position.lat, longitude: position.lng });
}

export async function acceptLeadLocationAction(leadId: string, messageId: string): Promise<LeadCommandResult> {
    return postLeadCommand(leadId, `location-candidates/${encodeURIComponent(messageId)}/accept`);
}

export type AnonymizeLeadResult =
    | { outcome: LeadAnonymizeOutcome; error: null }
    | { outcome: null; error: CodedError };

export async function anonymizeLeadAction(leadId: string): Promise<AnonymizeLeadResult> {
    const response = await apiClient<LeadAnonymizeOutcome>(`${leadPath(leadId)}/anonymize`, { method: 'POST' });
    if (response.error) return { outcome: null, error: codedErrorOf(response.error) };
    if (!hasVersion(response.data) || typeof response.data.anonymizedAt !== 'string') {
        return { outcome: null, error: EMPTY_ANSWER };
    }
    return { outcome: response.data, error: null };
}

export type EntryLeadCardResult = { card: LeadCard; error: null } | { card: null; error: CodedError };

function isLeadCard(value: unknown): value is LeadCard {
    return hasVersion(value) && typeof (value as { leadId?: unknown }).leadId === 'string';
}

export async function getEntryLeadCardAction(
    entryId: string,
    entryType: ConversationEntryType,
    signal?: AbortSignal,
): Promise<EntryLeadCardResult> {
    const query = new URLSearchParams({ entryType }).toString();
    const response = await apiClient<LeadCard>(`/entries/${encodeURIComponent(entryId)}/lead?${query}`, { method: 'GET', signal });
    if (response.error) return { card: null, error: codedErrorOf(response.error) };
    if (!isLeadCard(response.data)) return { card: null, error: EMPTY_ANSWER };
    return { card: response.data, error: null };
}

export interface AddLeadRelativeInput {
    kind: LeadRelationKind;
    relative: CreateLeadBody;
    copyPrimaryAddress: boolean;
}

export interface AddedLeadRelative {
    lead: LeadRecord;
    relative: LeadRecord;
    relation: LeadRelation;
    duplicates: CreatedLead['duplicates'];
}

export type LeadRelationResult<T> = { result: T; error: null } | { result: null; error: LeadRefusal };

function isRelation(value: unknown): value is LeadRelation {
    return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

export async function addLeadRelativeAction(
    leadId: string,
    input: AddLeadRelativeInput,
): Promise<LeadRelationResult<AddedLeadRelative>> {
    const response = await apiClient<AddedLeadRelative>(`${leadPath(leadId)}/relatives`, {
        method: 'POST',
        body: JSON.stringify({
            kind: input.kind,
            relative: input.relative,
            ...(input.copyPrimaryAddress ? { copyPrimaryAddress: true } : {}),
        }),
    });
    if (response.error) return { result: null, error: codedRefusalOf(response.error) };
    const data = response.data;
    if (!data || !isLeadRecord(data.relative) || !isRelation(data.relation)) return { result: null, error: EMPTY_ANSWER };
    return { result: { ...data, duplicates: data.duplicates ?? [] }, error: null };
}

export async function linkLeadRelationAction(
    leadId: string,
    otherLeadId: string,
    kind: LeadRelationKind,
): Promise<LeadRelationResult<LeadRelation>> {
    const response = await apiClient<{ lead: LeadRecord; relation: LeadRelation }>(`${leadPath(leadId)}/relations`, {
        method: 'POST',
        body: JSON.stringify({ otherLeadId, kind }),
    });
    if (response.error) return { result: null, error: codedRefusalOf(response.error) };
    if (!isRelation(response.data?.relation)) return { result: null, error: EMPTY_ANSWER };
    return { result: response.data.relation, error: null };
}

export async function removeLeadRelationAction(relationId: string): Promise<{ error: LeadRefusal | null }> {
    const response = await apiClient<void>(`/lead-relations/${encodeURIComponent(relationId)}`, { method: 'DELETE' });
    return { error: response.error ? codedRefusalOf(response.error) : null };
}

export async function listLeadRelativesAction(
    leadId: string,
    params: { dimension?: 'family' | 'referral'; after?: string; limit?: number } = {},
    signal?: AbortSignal,
): Promise<{ page: LeadRelativesPage | null; error: LeadRefusal | null }> {
    const qs = new URLSearchParams();
    if (params.dimension) qs.set('dimension', params.dimension);
    if (params.after) qs.set('after', params.after);
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    const response = await apiClient<LeadRelativesPage>(`${leadPath(leadId)}/relatives${query ? `?${query}` : ''}`, { method: 'GET', signal });
    if (response.error) return { page: null, error: codedRefusalOf(response.error) };
    if (!response.data || !Array.isArray(response.data.items)) return { page: null, error: EMPTY_ANSWER };
    return { page: response.data, error: null };
}

export interface LeadHistoryPageParams {
    before?: string;
    limit?: number;
}

function historyPagePath(leadId: string, route: 'timeline' | 'deals', params: LeadHistoryPageParams): string {
    const qs = new URLSearchParams();
    if (params.before) qs.set('before', params.before);
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return `${leadPath(leadId)}/${route}${query ? `?${query}` : ''}`;
}

async function readHistoryPage<T>(
    path: string,
    read: (value: unknown) => T | null,
    signal?: AbortSignal,
): Promise<{ page: T | null; error: LeadRefusal | null }> {
    const response = await apiClient<unknown>(path, { method: 'GET', signal });
    if (response.error) return { page: null, error: codedRefusalOf(response.error) };
    const page = read(response.data);
    if (!page) return { page: null, error: EMPTY_ANSWER };
    return { page, error: null };
}

export async function listLeadTimelineAction(
    leadId: string,
    params: LeadHistoryPageParams = {},
    signal?: AbortSignal,
): Promise<{ page: LeadTimelinePage | null; error: LeadRefusal | null }> {
    return readHistoryPage(historyPagePath(leadId, 'timeline', params), readTimelinePage, signal);
}

export async function listLeadDealsAction(
    leadId: string,
    params: LeadHistoryPageParams = {},
    signal?: AbortSignal,
): Promise<{ page: LeadDealsPage | null; error: LeadRefusal | null }> {
    return readHistoryPage(historyPagePath(leadId, 'deals', params), readDealsPage, signal);
}

export type BlockLeadResult =
    | { outcome: LeadBlockOutcome; error: null }
    | { outcome: null; error: CodedError };

export async function blockLeadAction(
    leadId: string,
    block: boolean,
    businessPhoneId?: string
): Promise<BlockLeadResult> {
    const response = await apiClient<LeadBlockOutcome>(`${leadPath(leadId)}/block`, {
        method: 'POST',
        body: JSON.stringify({
            blocked: block,
            ...(businessPhoneId ? { businessPhoneId } : {}),
        }),
    });

    if (response.error) return { outcome: null, error: codedErrorOf(response.error) };
    if (!hasVersion(response.data)) return { outcome: null, error: EMPTY_ANSWER };
    return { outcome: response.data, error: null };
}

type LeadDetailRead = { lead: LeadDetail; error: null } | { lead: null; error: CodedError };

async function readLeadDetail(path: string, signal?: AbortSignal): Promise<LeadDetailRead> {
    const response = await apiClient<LeadDetail>(path, { method: 'GET', signal });

    if (response.error) return { lead: null, error: codedErrorOf(response.error) };
    if (!isLeadRecord(response.data)) return { lead: null, error: EMPTY_ANSWER };
    return { lead: response.data, error: null };
}

export async function getLeadByIdAction(leadId: string, signal?: AbortSignal): Promise<LeadDetailRead> {
    return readLeadDetail(leadPath(leadId), signal);
}

export type LeadSummaryRead = { summary: LeadDetailSummary; error: null } | { summary: null; error: CodedError };

export async function getLeadSummaryAction(leadId: string, signal?: AbortSignal): Promise<LeadSummaryRead> {
    const response = await apiClient<unknown>(`${leadPath(leadId)}/summary`, { method: 'GET', signal });
    if (response.error) return { summary: null, error: codedErrorOf(response.error) };
    const summary = readLeadSummary(response.data);
    if (!summary) return { summary: null, error: EMPTY_ANSWER };
    return { summary, error: null };
}

export interface LeadLookupMatch {
    id: string;
    realName?: string;
    number: string;
}

export type LeadLookupResult = { matches: LeadLookupMatch[]; error: CodedError | null };

const LEAD_LOOKUP_PAGE_SIZE = 5;
const NO_HOLDER_STATUSES = new Set([400, 404]);

function lookupMatchOf(lead: { id: string; realName?: string; number: string }): LeadLookupMatch {
    return { id: lead.id, realName: lead.realName, number: lead.number };
}

export async function findLeadByNumberAction(number: string, signal?: AbortSignal): Promise<LeadLookupResult> {
    const read = await readLeadDetail(`/leads/search?number=${encodeURIComponent(number)}`, signal);
    if (read.lead) return { matches: [lookupMatchOf(read.lead)], error: null };
    if (read.error.status !== undefined && NO_HOLDER_STATUSES.has(read.error.status)) return { matches: [], error: null };
    return { matches: [], error: read.error };
}

export async function findLeadsByNameAction(name: string): Promise<LeadLookupResult> {
    const result = await listLeadsQueryAction({
        filter: withText(emptyCrmFilter, 'name', name),
        pageSize: LEAD_LOOKUP_PAGE_SIZE,
    });
    if (result.error) return { matches: [], error: { message: result.error } };
    return { matches: result.items.map(lookupMatchOf), error: null };
}

export async function listAnalysisAction(params: AnalysisListParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.campaignId) queryParams.set('campaignId', params.campaignId);
    if (params.whatsappCampaignId) queryParams.set('whatsappCampaignId', params.whatsappCampaignId);
    if (params.leadId) queryParams.set('leadId', params.leadId);
    if (params.entryType) queryParams.set('entryType', params.entryType);
    if (params.interest) queryParams.set('interest', params.interest);
    if (params.disposition) queryParams.set('disposition', params.disposition);
    if (params.sentiment) queryParams.set('sentiment', params.sentiment);
    if (params.qualification) queryParams.set('qualification', params.qualification);
    if (params.nextAction) queryParams.set('nextAction', params.nextAction);
    if (params.attendanceQualityMin !== undefined) {
        queryParams.set('attendanceQualityMin', params.attendanceQualityMin.toString());
    }
    if (params.attendanceQualityMax !== undefined) {
        queryParams.set('attendanceQualityMax', params.attendanceQualityMax.toString());
    }
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.order) queryParams.set('order', params.order);

    const queryString = queryParams.toString();
    const url = `/analysis${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<AnalysisListResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            analyses: [] as LeadAnalysis[],
            meta: DEFAULT_LEADS_META,
            error: response.error.message,
        };
    }

    const data = response.data?.data;

    return {
        analyses: data?.items ?? [],
        meta: {
            page: data?.page ?? 1,
            pageSize: data?.pageSize ?? 20,
            totalPages: data?.totalPages ?? 1,
            totalItems: data?.totalItems ?? 0,
        },
        error: null,
    };
}

export async function getEntryConversationAction(
    entryId: string,
    entryType: ConversationEntryType = 'voice',
) {
    const queryParams = new URLSearchParams();
    queryParams.set('entryType', entryType);

    const url = `/entries/${entryId}/conversation?${queryParams.toString()}`;

    const response = await apiClient<EntryConversationResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { conversation: null, error: response.error.message };
    }

    return { conversation: response.data ?? null, error: null };
}

export interface LeadsQueryResult {
    items: LeadListItem[];
    meta: LeadsListMeta;
    error: string | null;
    errorCode: string | null;
}

export async function listLeadsQueryAction(
    params: LeadsQueryParams = {},
): Promise<LeadsQueryResult> {
    const queryString = leadsQueryString(params);
    const response = await apiClient<{
        data: LeadListItem[];
        meta: LeadsListMeta;
    }>(`/leads${queryString ? `?${queryString}` : ''}`, { method: 'GET' });

    if (response.error) {
        return {
            items: [],
            meta: DEFAULT_LEADS_META,
            error: response.error.message,
            errorCode: response.error.code ?? null,
        };
    }

    const payload = response.data;
    return {
        items: payload?.data ?? [],
        meta: {
            page: payload?.meta?.page ?? 1,
            pageSize: payload?.meta?.pageSize ?? DEFAULT_LEADS_META.pageSize,
            totalPages: payload?.meta?.totalPages ?? 1,
            totalItems: payload?.meta?.totalItems ?? 0,
        },
        error: null,
        errorCode: null,
    };
}

export async function fetchLeadSection<S extends LeadSection>(
    section: S,
    params: LeadSectionParams,
    signal?: AbortSignal,
): Promise<LeadSectionPayloads[S]> {
    const response = await apiClient<LeadSectionPayloads[S]>(leadSectionPath(section, params), { method: 'GET', signal });
    return requireSectionData(response, `lead section ${section}`);
}

export async function renameLeadAction(
    leadId: string,
    name: string,
    version: number | undefined,
): Promise<LeadSaveResult> {
    return saveLeadRecord('PATCH', leadId, version, { name });
}
