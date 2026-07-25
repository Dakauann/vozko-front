export type RedirectType = "301" | "302";
export type LinkStatus = "active" | "inactive";

export interface ShortLink {
  id: string;
  workspaceId: string;
  departmentId?: string;
  createdBy?: string;
  code: string;
  shortUrl?: string;
  targetUrl: string;
  title?: string;
  redirectType: RedirectType;
  status: LinkStatus;
  hasPassword: boolean;
  expiresAt?: string;
  maxClicks?: number;
  clickCount: number;
  uniqueClickCount: number;
  lastClickedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Click {
  id: string;
  shortLinkId: string;
  workspaceId: string;
  occurredAt: string;
  country?: string;
  region?: string;
  city?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  refererDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  isBot: boolean;
  isProxy: boolean;
  language?: string;
}

export interface TimePoint {
  date: string;
  clicks: number;
}

export interface DimensionCount {
  label: string;
  clicks: number;
}

export interface LinkAnalytics {
  totalClicks: number;
  uniqueClicks: number;
  timeSeries: TimePoint[];
  byCountry: DimensionCount[];
  byDevice: DimensionCount[];
  byReferer: DimensionCount[];
  byBrowser: DimensionCount[];
  byOs: DimensionCount[];
}

export interface WorkspaceLinkStats {
  totalLinks: number;
  totalClicks: number;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface CreateShortLinkPayload {
  targetUrl: string;
  customAlias?: string;
  title?: string;
  redirectType?: RedirectType;
  password?: string;
  departmentId?: string;
  expiresAt?: string;
  maxClicks?: number;
}

export interface UpdateShortLinkPayload {
  targetUrl?: string;
  title?: string;
  redirectType?: RedirectType;
  status?: LinkStatus;
  password?: string;
  expiresAt?: string;
  maxClicks?: number;
  clearPassword?: boolean;
  clearExpiry?: boolean;
  clearMaxClicks?: boolean;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
