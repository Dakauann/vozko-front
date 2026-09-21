import type { CrmFilter } from '@/lib/crm/board';


export type OpportunityStatus = 'open' | 'won' | 'lost';

export interface Opportunity {
    id: string;
    workspaceId: string;
    leadId?: string;
    pipelineId: string;
    stageId: string;
    ownerId?: string;
    carteiraId?: string;
    title: string;
    valueCents: number;
    currency: string;
    status: OpportunityStatus;
    lostReasonId?: string;
    source?: string;
    closeDate?: string | null;
    customFields?: Record<string, unknown> | null;
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
    conversationAssigneeId?: string;
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
    closeDate?: string | null;
    customFields?: Record<string, unknown>;
    stageId?: string;
    status?: OpportunityStatus;
    lostReasonId?: string;
}

export interface MoveOpportunityInput {
    stageId: string;
    status?: OpportunityStatus;
    lostReasonId?: string;
}

export interface OpportunityConversationLink {
    opportunityId: string;
    entryId: string;
    entryType: string;
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


export function daysUntil(iso?: string | null): number | null {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return Math.round((then - startOfToday.getTime()) / 86_400_000);
}

export function idleDays(iso?: string | null): number {
    if (!iso) return 0;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 0;
    return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export type DealSignalTone = "success" | "warning" | "danger" | "info" | "neutral";

export function closeDateSignal(
    closeDate: string | null | undefined,
    status: OpportunityStatus,
): { tone: DealSignalTone; label: string } | null {
    if (status !== "open") return null;
    const d = daysUntil(closeDate);
    if (d === null) return null;
    if (d < 0) return { tone: "danger", label: d === -1 ? "Venceu ontem" : `Atrasada ${Math.abs(d)}d` };
    if (d === 0) return { tone: "warning", label: "Fecha hoje" };
    if (d <= 3) return { tone: "warning", label: `Fecha em ${d}d` };
    return { tone: "info", label: shortDate(closeDate!) };
}

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
