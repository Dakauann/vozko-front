import type {
    AnalysisDetail,
    AnalysisPatch,
    AnalysisPayload,
    AnalysisRun,
    CreateGroupPayload,
    DiscoverResult,
    GroupAnalysis,
    GroupAnalysisRow,
    GroupCampaign,
    GroupDetail,
    GroupMember,
    GroupMessagesPage,
    GroupPerson,
    GroupRef,
    GroupRow,
    GroupsDashboard,
    InvitePreview,
    JoinGroupPayload,
    JoinResult,
    JoinTask,
    LeadLinkResult,
    ManagedGroupResult,
    MemberAction,
    MembershipWindow,
    ListAnalysesParams,
    ListGroupsParams,
    ListMembersParams,
    MembershipParams,
    MembershipStat,
    MembershipSummary,
    PageMeta,
    ThemeAggregate,
    TranscriptLine,
    UpdateGroupPayload,
    WorkspaceGroup,
} from '@/lib/unofficial-whatsapp-groups/types';

import { apiClient } from '@/lib/api/browser-client';
import { downloadApiFile } from '@/lib/api/download-file';
import { memberExportQuery, type MemberExportTarget } from '@/lib/unofficial-whatsapp-groups/member-export';

const BASE = '/unofficial-whatsapp/groups';

const EMPTY_META: PageMeta = { page: 1, pageSize: 20, totalPages: 0, totalItems: 0 };

interface Page<T> {
    data: T[];
    meta: PageMeta;
}

type QueryValue = string | number | boolean | undefined;

function query(params: Record<string, QueryValue> = {}): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        search.set(key, String(value));
    }
    const text = search.toString();
    return text ? `?${text}` : '';
}

async function getOne<T>(path: string) {
    const response = await apiClient<T>(path, { method: 'GET' });
    if (response.error) return { error: response.error.message, status: response.error.status };
    return { data: response.data as T };
}

async function getPage<T>(path: string) {
    const response = await apiClient<Page<T>>(path, { method: 'GET' });
    if (response.error) return { items: [] as T[], meta: EMPTY_META, error: response.error.message };
    return { items: response.data?.data ?? [], meta: response.data?.meta ?? EMPTY_META };
}

async function send<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    const response = await apiClient<T>(path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.error) return { error: response.error.message, code: response.error.code };
    return { data: response.data as T };
}

export async function getGroupsDashboardAction() {
    return getOne<GroupsDashboard>(`${BASE}/dashboard`);
}

export async function getMembershipAction(params: MembershipParams = {}) {
    const response = await apiClient<Page<MembershipStat> & { summary: MembershipSummary } & MembershipWindow>(
        `${BASE}/membership${query({ ...params })}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { rows: [] as MembershipStat[], meta: EMPTY_META, summary: null, window: null as MembershipWindow | null, error: response.error.message };
    }
    const data = response.data;
    return {
        rows: data?.data ?? [],
        meta: data?.meta ?? EMPTY_META,
        summary: data?.summary ?? null,
        window: data ? ({ from: data.from, to: data.to, timezone: data.timezone } as MembershipWindow) : null,
    };
}

export async function listGroupPeopleAction(params: { search?: string; minGroups?: number; page?: number; pageSize?: number } = {}) {
    return getPage<GroupPerson>(`${BASE}/people${query(params)}`);
}

export async function listGroupThemesAction(params: { days?: number; search?: string; page?: number; pageSize?: number } = {}) {
    return getPage<ThemeAggregate>(`${BASE}/themes${query(params)}`);
}

export async function listGroupCategoriesAction() {
    const result = await getOne<string[]>(`${BASE}/categories`);
    return { categories: result.data ?? [], error: result.error };
}

export async function listWorkspaceGroupsAction(params: ListGroupsParams = {}) {
    return getPage<GroupRow>(`${BASE}${query({ ...params })}`);
}

export async function discoverGroupsAction() {
    return send<DiscoverResult>(`${BASE}/discover`, 'POST');
}

export async function getWorkspaceGroupAction(groupId: string) {
    return getOne<GroupDetail>(`${BASE}/${groupId}`);
}

export async function updateWorkspaceGroupAction(groupId: string, payload: UpdateGroupPayload) {
    return send<WorkspaceGroup>(`${BASE}/${groupId}`, 'PATCH', payload);
}

export async function followGroupAction(groupId: string) {
    return send<WorkspaceGroup>(`${BASE}/${groupId}/follow`, 'POST');
}

export async function unfollowGroupAction(groupId: string) {
    return send<WorkspaceGroup>(`${BASE}/${groupId}/unfollow`, 'POST');
}

export async function refreshGroupAction(groupId: string) {
    return send<WorkspaceGroup>(`${BASE}/${groupId}/refresh`, 'POST');
}

export async function nextGroupInSeriesAction(groupId: string) {
    return send<ManagedGroupResult>(`${BASE}/${groupId}/series`, 'POST');
}

export async function manageGroupMembersAction(groupId: string, action: MemberAction, participants: string[]) {
    return send<WorkspaceGroup>(`${BASE}/${groupId}/participants`, action === 'remove' ? 'DELETE' : 'POST', { action, participants });
}

export async function leaveWorkspaceGroupAction(groupId: string, instanceIds: string[]) {
    return send<{ left: boolean }>(`${BASE}/${groupId}/leave`, 'POST', { instanceIds });
}

export async function getGroupMessagesAction(groupId: string, before?: string) {
    return getOne<GroupMessagesPage>(`${BASE}/${groupId}/messages${query({ before })}`);
}

export async function getWorkspaceGroupInviteLinkAction(groupId: string) {
    const result = await getOne<{ inviteLink: string }>(`${BASE}/${groupId}/invite-link`);
    return { inviteLink: result.data?.inviteLink ?? '', error: result.error };
}

export async function listGroupCampaignsAction(groupId: string) {
    const result = await getOne<GroupCampaign[]>(`${BASE}/${groupId}/campaigns`);
    return { campaigns: result.data ?? [], error: result.error };
}

export async function listGroupMembersAction(groupId: string, params: ListMembersParams = {}) {
    return getPage<GroupMember>(`${BASE}/${groupId}/members${query({ ...params })}`);
}

export async function exportMembersAction(target: MemberExportTarget) {
    const search = memberExportQuery(target);
    if (!search) return { error: undefined };
    const { error } = await downloadApiFile(`${BASE}/members/export${search}`, 'membros.csv', { accept: 'text/csv' });
    return { error: error?.message };
}

export async function addGroupPeopleToLeadsAction(personKeys: string[]) {
    return send<LeadLinkResult>(`${BASE}/people/leads`, 'POST', { personKeys });
}

export async function addGroupMembersToLeadsAction(groupId: string, personKeys: string[]) {
    return send<LeadLinkResult>(`${BASE}/${groupId}/members/leads`, 'POST', { personKeys });
}

export async function createWorkspaceGroupAction(payload: CreateGroupPayload) {
    return send<ManagedGroupResult>(BASE, 'POST', payload);
}

export async function previewGroupInviteAction(inviteLink: string) {
    return send<InvitePreview>(`${BASE}/invites/preview`, 'POST', { inviteLink });
}

export async function joinWorkspaceGroupAction(payload: JoinGroupPayload) {
    return send<JoinResult>(`${BASE}/joins`, 'POST', payload);
}

export async function addGroupNumbersAction(groupId: string, instanceIds: string[]) {
    return send<JoinResult>(`${BASE}/${encodeURIComponent(groupId)}/numbers`, 'POST', { instanceIds });
}

export async function listGroupJoinsAction() {
    const result = await getOne<JoinTask[]>(`${BASE}/joins`);
    return { tasks: result.data ?? [], error: result.error };
}

export async function cancelGroupJoinAction(planId: string) {
    return send<{ cancelled: number }>(`${BASE}/joins/${planId}/cancel`, 'POST');
}

export async function listGroupAnalysesAction(params: ListAnalysesParams = {}) {
    return getPage<GroupAnalysisRow>(`${BASE}/analyses${query({ ...params })}`);
}

export async function createGroupAnalysisAction(payload: AnalysisPayload) {
    return send<GroupAnalysis>(`${BASE}/analyses`, 'POST', payload);
}

export async function getGroupAnalysisAction(analysisId: string, days?: number) {
    return getOne<AnalysisDetail>(`${BASE}/analyses/${analysisId}${query({ days })}`);
}

export async function updateGroupAnalysisAction(analysisId: string, patch: AnalysisPatch) {
    return send<GroupAnalysis>(`${BASE}/analyses/${analysisId}`, 'PATCH', patch);
}

export async function deleteGroupAnalysisAction(analysisId: string) {
    return send<{ deleted: boolean }>(`${BASE}/analyses/${analysisId}`, 'DELETE');
}

export async function listGroupAnalysisRunsAction(analysisId: string, params: { page?: number; pageSize?: number } = {}) {
    const response = await apiClient<Page<AnalysisRun> & { participantGroups: Record<string, GroupRef[]> }>(
        `${BASE}/analyses/${analysisId}/runs${query(params)}`,
        { method: 'GET' },
    );
    if (response.error) return { items: [] as AnalysisRun[], meta: EMPTY_META, participantGroups: {} as Record<string, GroupRef[]>, error: response.error.message };
    return {
        items: response.data?.data ?? [],
        meta: response.data?.meta ?? EMPTY_META,
        participantGroups: response.data?.participantGroups ?? {},
    };
}

export async function listGroupRunMessagesAction(analysisId: string, runId: string, offset = 0) {
    const result = await getOne<TranscriptLine[]>(`${BASE}/analyses/${analysisId}/runs/${runId}/messages${query({ offset })}`);
    return { lines: result.data ?? [], error: result.error };
}
