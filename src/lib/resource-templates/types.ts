export type ResourceType =
    | "agent"
    | "workflow"
    | "stage_group"
    | "label_group"
    | "tool"
    | "support_inbox";

export type TemplateCategory =
    | "retail"
    | "healthcare"
    | "finance"
    | "real_estate"
    | "education"
    | "hospitality"
    | "automotive"
    | "professional_services"
    | "technology"
    | "government"
    | "food_beverage"
    | "manufacturing"
    | "fitness"
    | "legal"
    | "nonprofit"
    | "media"
    | "general";

export type TemplateSubcategory =
    | "customer_support"
    | "active_sales"
    | "lead_qualification"
    | "scheduling"
    | "onboarding"
    | "feedback_survey"
    | "order_tracking"
    | "billing_collections"
    | "internal_helpdesk"
    | "training"
    | "property_search"
    | "visit_scheduling"
    | "market_info"
    | "general";

export type TemplateStatus = "draft" | "published" | "archived";

export interface ResourceTemplate {
    id: string;
    resourceType: ResourceType;
    category: TemplateCategory;
    subcategory: TemplateSubcategory;
    name: string;
    description: string;
    icon: string;
    tags: string[];
    snapshot: unknown;
    isFeatured: boolean;
    position: number;
    installCount: number;
    status: TemplateStatus;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface TemplateInstall {
    id: string;
    templateId: string;
    workspaceId: string;
    installedBy: string;
    resourceId: string;
    resourceType: string;
    installedAt: string;
}

export interface CreateTemplatePayload {
    resourceType: ResourceType;
    category: TemplateCategory;
    subcategory?: TemplateSubcategory;
    name: string;
    description?: string;
    icon?: string;
    tags?: string[];
    snapshot: unknown;
    isFeatured?: boolean;
    position?: number;
}

export interface UpdateTemplatePayload extends CreateTemplatePayload { }

export interface TemplateListParams {
    page?: number;
    pageSize?: number;
    search?: string;
    resourceType?: ResourceType;
    category?: TemplateCategory;
    subcategory?: TemplateSubcategory;
    status?: TemplateStatus;
    featured?: boolean;
    sort?: string;
}

export interface TemplateListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface TemplateListResponse {
    items?: ResourceTemplate[];
    data?: ResourceTemplate[];
    page?: number;
    page_size?: number;
    total_items?: number;
    total_pages?: number;
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
    agent: "Agent",
    workflow: "Workflow",
    stage_group: "Stage Group",
    label_group: "Label Group",
    tool: "Tool",
    support_inbox: "Support Inbox",
};

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
    retail: "Retail",
    healthcare: "Healthcare",
    finance: "Finance",
    real_estate: "Real Estate",
    education: "Education",
    hospitality: "Hospitality",
    automotive: "Automotive",
    professional_services: "Professional Services",
    technology: "Technology",
    government: "Government",
    food_beverage: "Food & Beverage",
    manufacturing: "Manufacturing",
    fitness: "Fitness",
    legal: "Legal",
    nonprofit: "Nonprofit",
    media: "Media",
    general: "General",
};

export const SUBCATEGORY_LABELS: Record<TemplateSubcategory, string> = {
    customer_support: "Customer Support",
    active_sales: "Active Sales",
    lead_qualification: "Lead Qualification",
    scheduling: "Scheduling",
    onboarding: "Onboarding",
    feedback_survey: "Feedback & Survey",
    order_tracking: "Order Tracking",
    billing_collections: "Billing & Collections",
    internal_helpdesk: "Internal Helpdesk",
    training: "Training",
    property_search: "Property Search",
    visit_scheduling: "Visit Scheduling",
    market_info: "Market Info",
    general: "General",
};