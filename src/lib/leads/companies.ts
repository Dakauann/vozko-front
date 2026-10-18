import { encodeFilterParam, type CrmFilter } from "@/lib/crm/board";
import { isCount, isJson, isText } from "@/lib/json/guards";
import { LEAD_FILTER_FIELD } from "@/lib/leads/filters";

export const LEAD_COMPANY_NAME_MAX = 120;
export const LEAD_COMPANY_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const LEAD_COMPANY_IMAGE_BYTES = 5 * 1024 * 1024;

export interface LeadCompanyImage {
  mediaId: string;
  url: string;
  previewUrl?: string;
}

export interface LeadCompany {
  id: string;
  name: string;
  acceptsLeads: boolean;
  image?: LeadCompanyImage;
  membersCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadCompanyPage {
  items: LeadCompany[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface LeadCompanyDraft {
  name: string;
  acceptsLeads: boolean;
  imageMediaId?: string;
}

export interface LeadCompanyChange {
  name?: string;
  acceptsLeads?: boolean;
  imageMediaId?: string;
}

type LeadCompanyImageProblem = "lead_company_image_type" | "lead_company_image_too_large";

function imageOf(value: unknown): LeadCompanyImage | null {
  if (!isJson(value) || !isText(value.mediaId) || !isText(value.url)) return null;
  return isText(value.previewUrl) ? { mediaId: value.mediaId, url: value.url, previewUrl: value.previewUrl } : { mediaId: value.mediaId, url: value.url };
}

export function parseLeadCompany(value: unknown): LeadCompany | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.name) || typeof value.acceptsLeads !== "boolean") return null;
  if (!isCount(value.membersCount) || !isText(value.createdAt) || !isText(value.updatedAt)) return null;
  const company: LeadCompany = {
    id: value.id,
    name: value.name,
    acceptsLeads: value.acceptsLeads,
    membersCount: value.membersCount,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (value.image !== undefined) {
    const image = imageOf(value.image);
    if (!image) return null;
    company.image = image;
  }
  if (isText(value.createdBy)) company.createdBy = value.createdBy;
  return company;
}

export function parseLeadCompanyPage(value: unknown): LeadCompanyPage | null {
  if (!isJson(value) || !Array.isArray(value.data) || !isJson(value.meta)) return null;
  const items = value.data.map(parseLeadCompany);
  if (items.some((item) => item === null)) return null;
  const { page, pageSize, totalPages, totalItems } = value.meta;
  if (!isCount(page) || !isCount(pageSize) || !isCount(totalPages) || !isCount(totalItems)) return null;
  return { items: items as LeadCompany[], page, pageSize, totalPages, totalItems };
}

export function companyImageProblem(file: { type: string; size: number }): LeadCompanyImageProblem | null {
  if (!(LEAD_COMPANY_IMAGE_TYPES as readonly string[]).includes(file.type)) return "lead_company_image_type";
  if (file.size <= 0 || file.size > LEAD_COMPANY_IMAGE_BYTES) return "lead_company_image_too_large";
  return null;
}

export function companyImageUrl(company: Pick<LeadCompany, "image">): string {
  return company.image?.previewUrl || company.image?.url || "";
}

export function companyMembersFilter(companyId: string): CrmFilter {
  return { groups: [{ conjunction: "and", predicates: [{ field: LEAD_FILTER_FIELD.company, operator: "in", values: [companyId] }] }] };
}

export function companyMembersHref(leadsPath: string, companyId: string): string {
  return `${leadsPath}?${new URLSearchParams({ filter: encodeFilterParam(companyMembersFilter(companyId)) }).toString()}`;
}

export function companyChange(before: LeadCompany, after: Required<LeadCompanyDraft>): LeadCompanyChange {
  const change: LeadCompanyChange = {};
  if (after.name !== before.name) change.name = after.name;
  if (after.acceptsLeads !== before.acceptsLeads) change.acceptsLeads = after.acceptsLeads;
  if (after.imageMediaId !== (before.image?.mediaId ?? "")) change.imageMediaId = after.imageMediaId;
  return change;
}
