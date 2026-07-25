import type { CrmFilter } from '@/lib/crm/board';

// Client-safe types + helpers for the Opportunity (deal) surface. NO server-only
// imports here (this module is pulled into client components); the fetch calls
// live in app/actions/opportunities.ts, mirroring the board.ts / crm-board.ts
// split that keeps next/headers out of the client bundle.

export type OpportunityStatus = 'open' | 'won' | 'lost';

// Mirrors domain/opportunity.Opportunity. MONEY GUARDRAIL: valueCents is the
// customer's own sales figure (BRL by default), never Vozko wallet money.
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

// One board column. `entries` is null (Go nil slice) for an empty column — always
// coalesce before iterating.
export interface OpportunityColumn {
    id: string;
    name: string;
    color?: string;
    // Terminal-stage markers (stage axis only): style + drive the won/lost move flow.
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

// Board axis for opportunities: stage (default), owner swimlanes, or a single
// custom-select field (needs groupByKey). No standalone "label" axis yet.
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

// The mutable slice a caller supplies on create. The server owns id/status/
// timestamps; status starts "open". Either title or leadId is required.
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
    // create-from-chat: seed the owner from the conversation assignee + link it.
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

// Moving to a won/lost stage carries the outcome; the backend REQUIRES a
// lostReasonId when status is "lost".
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

// --- money helpers (BRL) -----------------------------------------------------

// Format value_cents as Brazilian currency, e.g. 490000 -> "R$ 4.900,00".
export function formatValueCents(cents: number, currency = 'BRL'): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
    }).format((cents ?? 0) / 100);
}

// Compact form for dense cards/column headers, e.g. 490000 -> "R$ 4,9 mil",
// 1250000 -> "R$ 1,25 mi". Falls back to the full format under 1.000.
export function formatValueCompact(cents: number, currency = 'BRL'): string {
    const value = (cents ?? 0) / 100;
    const abs = Math.abs(value);
    const prefix = currency === 'BRL' ? 'R$ ' : '';
    if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
    if (abs >= 1_000) return `${prefix}${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return formatValueCents(cents, currency);
}

// --- deal freshness signals (client-side, from timestamps) -------------------

// Whole days from now until an ISO date (negative = already past). null when no date.
export function daysUntil(iso?: string | null): number | null {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return Math.round((then - startOfToday.getTime()) / 86_400_000);
}

// Whole days a deal has sat untouched (since updatedAt). Drives the rotting chip.
export function idleDays(iso?: string | null): number {
    if (!iso) return 0;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 0;
    return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export type DealSignalTone = "success" | "warning" | "danger" | "info" | "neutral";

// Close-date urgency for an OPEN deal: overdue (danger) / due within 3d (warning)
// / scheduled (info). Won/lost or dateless deals return null (no urgency to show).
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

// Rotting indicator for an OPEN deal idle past a stage's threshold (Pipedrive
// style). Under the warn threshold it returns null (a fresh deal shows nothing).
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

// Short relative age for a card's third line: "hoje" / "há 5d" / "12 mar".
export function relativeAge(iso?: string | null): string {
    if (!iso) return "";
    const d = idleDays(iso);
    if (d <= 0) return "hoje";
    if (d === 1) return "ontem";
    if (d < 30) return `há ${d}d`;
    return shortDate(iso);
}

// "12 mar" style short date in pt-BR.
export function shortDate(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(t));
}

// Parse a user-typed BRL amount ("4.900,00", "4900", "R$ 4.900") into cents.
// Returns 0 for empty/invalid input.
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
