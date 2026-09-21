export type AnalyticsGranularity = "hour" | "day" | "week" | "month" | "total";

export type AnalyticsSortDirection = "asc" | "desc";

export interface AnalyticsPeriod {
    startDate: string;
    endDate: string;
}

export interface AnalyticsFinancialTotals {
    revenueMicros: number;
    costMicros: number;
    profitMicros: number;
    revenueBRLMicros: number;
    costBRLMicros: number;
    profitBRLMicros: number;
    marginPct: number;
    txCount: number;
}

export interface AnalyticsServiceBreakdown {
    serviceType: string;
    totals: AnalyticsFinancialTotals;
}

export interface AnalyticsWorkspaceBreakdown {
    workspaceId: string;
    totals: AnalyticsFinancialTotals;
}

export interface AnalyticsPeriodBucket {
    periodStart: string;
    periodEnd: string;
    totals: AnalyticsFinancialTotals;
    byService?: AnalyticsServiceBreakdown[];
}

export interface ProfitReport {
    period: AnalyticsPeriod;
    totals: AnalyticsFinancialTotals;
    byService: AnalyticsServiceBreakdown[];
    timeSeries: AnalyticsPeriodBucket[];
    topWorkspaces?: AnalyticsWorkspaceBreakdown[];
}

export interface CallDimensionTotals {
    revenueMicros: number;
    costMicros: number;
    profitMicros: number;
}

export interface CallDimensionBreakdown {
    stt: CallDimensionTotals;
    tts: CallDimensionTotals;
    llm: CallDimensionTotals;
    telephony: CallDimensionTotals;
    total: CallDimensionTotals;
}

export interface CallUsageTotals {
    totalCalls: number;
    totalDurationSec: number;
    totalSTTAudioSec: number;
    totalTTSChars: number;
    totalLLMPromptTokens: number;
    totalLLMCompletionTokens: number;
    bySIPCount: number;
    byWebSocketCount: number;
}

export interface AgentBreakdown {
    agentId: string;
    financials: CallDimensionBreakdown;
    usage: CallUsageTotals;
}

export interface CallPeriodBucket {
    periodStart: string;
    periodEnd: string;
    financials: CallDimensionBreakdown;
    usage: CallUsageTotals;
}

export interface CallAnalyticsReport {
    period: AnalyticsPeriod;
    financials: CallDimensionBreakdown;
    usage: CallUsageTotals;
    timeSeries: CallPeriodBucket[];
    byAgent?: AgentBreakdown[];
}

export interface WorkspaceFinancialSnapshot {
    workspaceId: string;
    workspaceName: string;
    currentBalanceMicros: number;
    periodCreditsMicros: number;
    revenueMicros: number;
    costMicros: number;
    profitMicros: number;
    revenueBRLMicros: number;
    costBRLMicros: number;
    profitBRLMicros: number;
    refundsMicros: number;
    refundsBRLMicros: number;
    marginPct: number;
    txCount: number;
    lastTransactionAt?: string | null;
}

export interface FocusedWorkspaceBalance {
    workspaceId: string;
    workspaceName: string;
    currentBalanceMicros: number;
    lifetimeCreditsMicros: number;
    lifetimeDebitsMicros: number;
    periodCreditsMicros: number;
    periodDebitsMicros: number;
    periodTxCount: number;
    lastTransactionAt?: string | null;
}

export interface RecentSpending {
    transactionId: string;
    workspaceId: string;
    workspaceName: string;
    serviceType: string;
    description: string;
    amountMicros: number;
    costMicros: number;
    profitMicros: number;
    exchangeRateMicros: number;
    balanceAfterMicros: number;
    createdAt: string;
}

export interface UsageMetric {
    key: string;
    count: number;
    revenueMicros?: number;
    revenueBRLMicros?: number;
}

export interface ProductUsageSummary {
    byService: UsageMetric[];
    whatsappTemplateCategories: UsageMetric[];
}

export interface PaginatedWorkspaceSnapshots {
    items: WorkspaceFinancialSnapshot[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface AdminOverview {
    period: AnalyticsPeriod;
    focusedWorkspace?: FocusedWorkspaceBalance | null;
    workspaceSnapshots: PaginatedWorkspaceSnapshots;
    recentSpendings: RecentSpending[];
    productUsage: ProductUsageSummary;
    totalPeriodCreditsMicros: number;
    totalPeriodCreditsBRLMicros: number;
    totalPeriodRefundsMicros: number;
    totalPeriodRefundsBRLMicros: number;
}

export interface PlanContraction {
    subscriptionId: string;
    workspaceId: string;
    workspaceName: string;
    planName: string;
    billingCycle: string;
    status: string;
    contractedAt: string;
}

export interface PlanContractionCount {
    key: string;
    count: number;
}

export interface PlanContractionBucket {
    periodStart: string;
    periodEnd: string;
    count: number;
}

export interface PlanContractionsReport {
    period: AnalyticsPeriod;
    totalCount: number;
    byPlan: PlanContractionCount[];
    byBillingCycle: PlanContractionCount[];
    timeSeries: PlanContractionBucket[];
    recent: PlanContraction[];
}

export interface GetPlanContractionsParams {
    startDate: string;
    endDate: string;
    granularity?: AnalyticsGranularity;
    recentLimit?: number;
}

export interface GetProfitReportParams {
    startDate: string;
    endDate: string;
    granularity?: AnalyticsGranularity;
    workspaceId?: string;
    serviceType?: string[];
    topN?: number;
}

export interface GetCallAnalyticsParams {
    startDate: string;
    endDate: string;
    granularity?: AnalyticsGranularity;
    workspaceId?: string;
    agentId?: string;
    campaignId?: string;
    callSource?: "sip" | "websocket";
}

export interface GetAdminOverviewParams {
    startDate: string;
    endDate: string;
    workspaceId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?:
    | "revenue"
    | "profit"
    | "cost"
    | "current_balance"
    | "period_credits"
    | "workspace_name"
    | "tx_count"
    | "last_transaction_at";
    sortOrder?: AnalyticsSortDirection;
    recentLimit?: number;
}

/* ------------------------------------------- META SERVICE MESSAGE EXPOSURE */

/**
 * From 1 October 2026 Meta charges for service messages: the free-form replies
 * an agent or the AI sends inside the 24 hour window. We absorb that and raise
 * the price per campaign trigger instead, which only works if we can see, per
 * workspace, how much messaging each one does against how much billable
 * campaign volume it buys.
 */

/** Which provider hosts the numbers a count covers. "" means every provider. */
export type ServiceMessageProvider = "" | "meta" | "dialog360" | "unattributed";

export type MetaServiceMessageCostSortField =
    | "ratio"
    | "serviceMessages"
    | "netBillableSends"
    | "workspaceName";

export interface WorkspaceMetaServiceMessageCost {
    workspaceId: string;
    workspaceName: string;
    /** Distinct providers behind the counted messages. */
    providers: string[];
    /** What Meta will charge us for. */
    serviceMessages: number;
    /** Template sends the workspace paid for: debits minus refunds. */
    netBillableSends: number;
    /**
     * The subset Meta itself stamped billable, rather than our inference.
     * Zero for everything delivered before the pricing columns existed, so it
     * climbs toward serviceMessages rather than starting there.
     */
    metaConfirmed: number;
    /**
     * Service messages per billable send.
     *
     * Absent when nothing was bought, which is NOT zero: it is the worst case
     * on this page, and rendering it as 0,00 would say the exact opposite of
     * what it means.
     */
    ratio?: number | null;
}

export interface MetaServiceMessageCostTotals {
    serviceMessages: number;
    netBillableSends: number;
    ratio?: number | null;
    workspacesCovered: number;
    /** How much of serviceMessages Meta has confirmed itself. */
    metaConfirmed: number;
    /**
     * How many of the counted messages Meta has given ANY verdict on.
     * Not the same as metaConfirmed: a message Meta said was free inside the
     * 72 hour entry point is answered but not confirmed. Coverage is what
     * decides whether inferredOnly is still true.
     */
    metaAnswered: number;
    /** Messages on campaigns with no business phone, so no provider is known. */
    unattributedServiceMessages: number;
}

export interface PaginatedMetaServiceMessageCost {
    items: WorkspaceMetaServiceMessageCost[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface MetaServiceMessageCostReport {
    period: AnalyticsPeriod;
    provider: ServiceMessageProvider;
    totals: MetaServiceMessageCostTotals;
    workspaces: PaginatedMetaServiceMessageCost;
    /**
     * True while the counts are our own reading of the message log rather than
     * Meta's billing truth, which makes every figure an upper bound.
     */
    inferredOnly: boolean;
}

export interface GetMetaServiceMessageCostParams {
    /** Both optional: sending neither asks for the current billing month. */
    startDate?: string;
    endDate?: string;
    provider?: ServiceMessageProvider | "all";
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: MetaServiceMessageCostSortField;
    sortOrder?: AnalyticsSortDirection;
}
