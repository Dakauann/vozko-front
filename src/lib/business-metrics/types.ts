
export interface BusinessMetric {
    id: string;
    event_type: string;
    entity_id: string;
    entity_type: string;
    user_id: string | null;
    metadata: Record<string, string>;
    occurred_at: string;
    created_at: string;
}

export interface MetricsListResponse {
    metrics: BusinessMetric[];
    total_count: number;
    total_pages: number;
    current_page: number;
    page_size: number;
    has_more: boolean;
}

export interface MetricsStatsResponse {
    event_counts: Record<string, number>;
    total_events: number;
    start_date: string;
    end_date: string;
}

export interface TimeSeriesDataPoint {
    timestamp: string;
    count: number;
}

export interface MetricsTimeSeriesResponse {
    data: Record<string, TimeSeriesDataPoint[]>;
    interval: string;
    start_date: string;
    end_date: string;
}

export interface MetricsListParams {
    event_type?: string;
    event_types?: string[];
    entity_type?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: "asc" | "desc";
}

export interface MetricsStatsParams {
    event_type?: string;
    event_types?: string[];
    start_date?: string;
    end_date?: string;
}

export interface MetricsTimeSeriesParams {
    event_type?: string;
    event_types?: string[];
    interval?: "hour" | "day" | "week" | "month";
    start_date?: string;
    end_date?: string;
}

export const EVENT_TYPES = {
    USER_ACCOUNT_CREATED: "user_account_created",
    USER_LOGIN: "user_login",
    CAMPAIGN_STARTED: "campaign_started",
    CAMPAIGN_STOPPED: "campaign_stopped",
    CALL_STARTED: "call_started",
    CALL_ENDED: "call_ended",
    WHATSAPP_MESSAGE_SENT: "whatsapp_message_sent",
    WHATSAPP_TEMPLATE_MESSAGE_SENT: "whatsapp_template_message_sent",
    EMAIL_SENT: "email_sent",
} as const;

export const ENTITY_TYPES = {
    USER: "user",
    CAMPAIGN: "campaign",
    CALL: "call",
    MESSAGE: "message",
    EMAIL: "email",
} as const;

export const EVENT_CATEGORIES = {
    users: [EVENT_TYPES.USER_ACCOUNT_CREATED, EVENT_TYPES.USER_LOGIN],
    campaigns: [EVENT_TYPES.CAMPAIGN_STARTED, EVENT_TYPES.CAMPAIGN_STOPPED],
    calls: [EVENT_TYPES.CALL_STARTED, EVENT_TYPES.CALL_ENDED],
    whatsapp: [EVENT_TYPES.WHATSAPP_MESSAGE_SENT, EVENT_TYPES.WHATSAPP_TEMPLATE_MESSAGE_SENT],
    email: [EVENT_TYPES.EMAIL_SENT],
} as const;
