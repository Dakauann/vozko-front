import type { CrmFilter } from '@/lib/crm/board';
import { normalizeActorKind } from '@/lib/conversations/events';


export type OpportunityStatus = 'open' | 'won' | 'lost';

export interface Opportunity {
    id: string;
    workspaceId: string;
    leadId?: string;
    pipelineId: string;
    stageId: string;
    ownerId?: string;
    ownerName?: string;
    carteiraId?: string;
    title: string;
    valueCents: number;
    currency: string;
    status: OpportunityStatus;
    lostReasonId?: string;
    source?: string;
    closeDate?: string | null;
    createdBy?: string;
    createdByName?: string;
    closedBy?: string;
    closedByName?: string;
    customFields?: Record<string, unknown> | null;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface OpportunityColumn {
    id: string;
    name: string;
    color?: string;
    isWon?: boolean;
    isLost?: boolean;
    total: number;
    valueTotal: number;
    entries: Opportunity[] | null;
}

export interface OpportunityBoard {
    groupBy: string;
    columns: OpportunityColumn[];
}

export interface OpportunityListResult {
    opportunities: Opportunity[] | null;
    total: number;
}

export type OpportunityGroupBy = 'stage' | 'owner' | 'custom';

export interface OpportunityBoardOwner {
    id: string;
    name: string;
}

export interface OpportunityBoardOption {
    value: string;
    name: string;
}

export interface FetchOpportunityBoardParams {
    pipelineId?: string;
    groupBy: OpportunityGroupBy;
    groupByKey?: string;
    filter?: CrmFilter;
    owners?: OpportunityBoardOwner[];
    options?: OpportunityBoardOption[];
    sortField?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
}

export interface FetchOpportunityListParams {
    filter?: CrmFilter;
    sortField?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
}

export interface CreateOpportunityInput {
    pipelineId: string;
    stageId: string;
    title?: string;
    leadId?: string;
    ownerId?: string;
    carteiraId?: string;
    valueCents?: number;
    currency?: string;
    source?: string;
    closeDate?: string | null;
    customFields?: Record<string, unknown>;
    linkEntryId?: string;
    linkEntryType?: string;
}

export interface UpdateOpportunityInput {
    title?: string;
    valueCents?: number;
    currency?: string;
    ownerId?: string;
    carteiraId?: string;
    source?: string;
    customFields?: Record<string, unknown>;
    stageId?: string;
    lostReasonId?: string;
    version?: number;
}

export interface MoveOpportunityInput {
    stageId: string;
    lostReasonId?: string;
    version?: number;
}

export type OpportunityEventType =
    | 'created'
    | 'stage_moved'
    | 'won'
    | 'lost'
    | 'reopened'
    | 'value_changed'
    | 'owner_changed'
    | 'linked';

export interface OpportunityEvent {
    id: string;
    opportunityId: string;
    type: OpportunityEventType;
    actorId: string;
    actorName?: string;
    fromStageId?: string;
    toStageId?: string;
    valueCents: number;
    currency: string;
    details?: Record<string, unknown>;
    createdAt: string;
}

export interface OpportunityConversationLink {
    opportunityId: string;
    entryId: string;
    entryType: string;
    leadName?: string;
    leadNumber?: string;
}


export interface DealActorLabels {
    ai: string;
    workflow: string;
    system: string;
    unknownMember: string;
}

export function dealActorName(
    actorId: string | undefined,
    members: ReadonlyMap<string, string>,
    labels: DealActorLabels,
    resolvedName?: string,
): string | null {
    const id = (actorId ?? '').trim();
    if (!id) return null;
    const name = resolvedName?.trim();
    switch (normalizeActorKind(undefined, id)) {
        case 'ai':
            return name ? `${name} · ${labels.ai}` : labels.ai;
        case 'workflow':
            return name ? `${name} · ${labels.workflow}` : labels.workflow;
        case 'system':
            return labels.system;
    }
    return members.get(id) ?? (name || labels.unknownMember);
}

export interface DealEventLabels {
    removedStage: string;
    money: (cents: number, currency: string) => string;
}

export interface DealEventMessage {
    key: OpportunityEventType;
    values: { actor: string; from: string; to: string; value: string };
}

export function dealEventMessage(
    event: OpportunityEvent,
    actorName: string,
    stageNames: ReadonlyMap<string, string>,
    labels: DealEventLabels,
): DealEventMessage {
    const stage = (id?: string) => (id && stageNames.get(id)) || labels.removedStage;
    return {
        key: event.type,
        values: {
            actor: actorName,
            from: stage(event.fromStageId),
            to: stage(event.toStageId),
            value: labels.money(event.valueCents ?? 0, event.currency || 'BRL'),
        },
    };
}

export function formatValueCents(cents: number, currency = 'BRL'): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
    }).format((cents ?? 0) / 100);
}

export function formatValueCompact(cents: number, currency = 'BRL'): string {
    const value = (cents ?? 0) / 100;
    const abs = Math.abs(value);
    const prefix = currency === 'BRL' ? 'R$ ' : '';
    if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
    if (abs >= 1_000) return `${prefix}${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return formatValueCents(cents, currency);
}


export function idleDays(iso?: string | null): number {
    if (!iso) return 0;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 0;
    return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export type DealSignalTone = "success" | "warning" | "danger" | "info" | "neutral";

export function rotSignal(
    status: OpportunityStatus,
    updatedAt: string,
    opts?: { warnDays?: number; staleDays?: number },
): { tone: DealSignalTone; label: string } | null {
    if (status !== "open") return null;
    const warn = opts?.warnDays ?? 7;
    const stale = opts?.staleDays ?? 14;
    const idle = idleDays(updatedAt);
    if (idle < warn) return null;
    return { tone: idle >= stale ? "danger" : "warning", label: `Parada ${idle}d` };
}

export function relativeAge(iso?: string | null): string {
    if (!iso) return "";
    const d = idleDays(iso);
    if (d <= 0) return "hoje";
    if (d === 1) return "ontem";
    if (d < 30) return `há ${d}d`;
    return shortDate(iso);
}

export function shortDate(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(t));
}

export function parseBRLToCents(input: string): number {
    if (!input) return 0;
    const cleaned = input
        .replace(/[^\d.,-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const value = Number.parseFloat(cleaned);
    if (Number.isNaN(value)) return 0;
    return Math.round(value * 100);
}
