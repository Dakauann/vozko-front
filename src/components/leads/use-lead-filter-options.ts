"use client";

import { useCallback, useMemo } from "react";
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listLabelsAction } from "@/app/actions/labels";
import { listStagesAction } from "@/app/actions/stages";
import { getWhatsAppCampaignByIdAction, listWhatsAppCampaignsAction } from "@/app/actions/whatsapp-campaigns";
import type { FilterMultiSelectOption } from "@/components/filters/filter-multi-select";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAssignableMembers } from "@/hooks/use-assignable-members";
import { useLeadCompaniesPage, useLeadCompanyNames } from "@/hooks/use-lead-companies";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { useLeadSection } from "@/hooks/use-lead-section";
import { readableClassificationField, type CustomFieldDefinition } from "@/lib/crm/custom-fields";
import {
  LEAD_FILTER_FIELD,
  customFieldFilterSpecs,
  emptyLeadFilter,
  withSet,
  type LeadCustomFilterSpec,
  type LeadRuntimeOptions,
} from "@/lib/leads/filters";
import type { LeadCityCount, LeadDistrictCount } from "@/lib/leads/sections";

const OPTION_SETS_STALE_MS = 60_000;
const CAMPAIGN_OPTIONS_LIMIT = 100;
const COMPANY_OPTIONS_LIMIT = 100;

const CRM_OPTION_SETS = ["campaigns", "stages", "labels"] as const;

type CrmOptionSet = (typeof CRM_OPTION_SETS)[number];

interface CrmOptionSets {
  campaigns: FilterMultiSelectOption[];
  stages: FilterMultiSelectOption[];
  labels: FilterMultiSelectOption[];
  failed: CrmOptionSet[];
}

async function loadCrmOptionSets(): Promise<CrmOptionSets> {
  const [campaigns, stages, labels] = await Promise.all([
    listWhatsAppCampaignsAction(1, CAMPAIGN_OPTIONS_LIMIT),
    listStagesAction(),
    listLabelsAction(),
  ]);
  const failed: CrmOptionSet[] = [];
  if (campaigns.error) failed.push("campaigns");
  if (stages.error) failed.push("stages");
  if (labels.error) failed.push("labels");
  return {
    campaigns: campaigns.campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
    stages: stages.stages.map((stage) => ({ value: stage.id, label: stage.name, color: stage.color })),
    labels: labels.labels.map((label) => ({ value: label.id, label: label.name, color: label.color })),
    failed,
  };
}

function unlistedIdsOf(listed: readonly FilterMultiSelectOption[], ids: readonly string[]): string[] {
  const known = new Set(listed.map((option) => option.value));
  return [...new Set(ids)].filter((id) => id !== "" && !known.has(id));
}

function withUnlisted(listed: FilterMultiSelectOption[], unlisted: readonly string[], names: ReadonlyMap<string, string>): FilterMultiSelectOption[] {
  if (unlisted.length === 0) return listed;
  return [
    ...listed,
    ...unlisted.flatMap((id) => {
      const name = names.get(id);
      return name ? [{ value: id, label: name }] : [];
    }),
  ];
}

function campaignNamesOf(results: UseQueryResult<{ id: string; name: string } | null>[]): ReadonlyMap<string, string> {
  return new Map(results.flatMap((result) => (result.data ? [[result.data.id, result.data.name] as const] : [])));
}

function useCampaignNames(workspaceId: string, campaignIds: readonly string[], enabled: boolean): ReadonlyMap<string, string> {
  return useQueries({
    combine: campaignNamesOf,
    queries: campaignIds.map((campaignId) => ({
      queryKey: [...leadFilterOptionsKey(workspaceId), "campaign", campaignId],
      queryFn: async () => {
        const result = await getWhatsAppCampaignByIdAction(campaignId);
        if (result.error) throw new Error(result.error);
        return result.campaign ? { id: result.campaign.id, name: result.campaign.name } : null;
      },
      enabled: enabled && workspaceId !== "",
      staleTime: OPTION_SETS_STALE_MS,
      refetchOnWindowFocus: false,
    })),
  });
}

function leadFilterOptionsKey(workspaceId: string) {
  return ["lead-filter-options", workspaceId] as const;
}

export interface LeadFilterOptionSets {
  campaigns: FilterMultiSelectOption[];
  stages: FilterMultiSelectOption[];
  labels: FilterMultiSelectOption[];
  companies: FilterMultiSelectOption[];
  cities: LeadCityCount[];
  districts: LeadDistrictCount[];
  members: ReadonlyMap<string, string>;
  definitions: CustomFieldDefinition[];
  customFields: LeadCustomFilterSpec[];
  classification?: CustomFieldDefinition;
  readsAddresses: boolean;
  readsCompanies: boolean;
  pending: LeadRuntimeOptions[];
  failed: LeadRuntimeOptions[];
  fieldsFailed: boolean;
  retry: () => void;
}

const NO_CITIES: LeadCityCount[] = [];
const NO_DISTRICTS: LeadDistrictCount[] = [];
const NO_OPTIONS: FilterMultiSelectOption[] = [];
const NO_IDS: readonly string[] = [];

export function useLeadFilterOptions({
  cityKeys = [],
  companyIds = NO_IDS,
  campaignIds = NO_IDS,
}: { cityKeys?: readonly string[]; companyIds?: readonly string[]; campaignIds?: readonly string[] } = {}): LeadFilterOptionSets {
  const { currentWorkspace, can } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const readsAddresses = can("leads", "read_addresses");
  const readsMembers = can("members", "read");
  const readsCompanies = can("lead_companies", "read");

  const crm = useQuery({
    queryKey: leadFilterOptionsKey(workspaceId),
    queryFn: loadCrmOptionSets,
    enabled: workspaceId !== "",
    staleTime: OPTION_SETS_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const fields = useLeadFieldDefinitions();
  const members = useAssignableMembers(readsMembers);
  const companyPage = useLeadCompaniesPage({ page: 1, pageSize: COMPANY_OPTIONS_LIMIT }, readsCompanies);

  const places = useLeadSection("places", { filter: emptyLeadFilter }, { enabled: true });
  const cityScope = withSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, [...cityKeys]);
  const scoped = cityKeys.length > 0;
  const cityPlaces = useLeadSection("places", { filter: cityScope }, { enabled: scoped });
  const districtSource = scoped ? cityPlaces : places;

  const definitions = fields.definitions;
  const customFields = useMemo(() => customFieldFilterSpecs(definitions), [definitions]);
  const classification = useMemo(() => readableClassificationField(definitions), [definitions]);

  const pending = useMemo<LeadRuntimeOptions[]>(() => {
    const out: LeadRuntimeOptions[] = [];
    if (crm.isPending) out.push(...CRM_OPTION_SETS);
    if (places.isPending) out.push("cities");
    if (districtSource.isPending) out.push("districts");
    if (members.pending) out.push("owners");
    if (readsCompanies && companyPage.isPending) out.push("companies");
    return out;
  }, [crm.isPending, places.isPending, districtSource.isPending, members.pending, readsCompanies, companyPage.isPending]);

  const failed = useMemo<LeadRuntimeOptions[]>(() => {
    const out: LeadRuntimeOptions[] = [...(crm.data?.failed ?? [])];
    if (crm.isError) out.push(...CRM_OPTION_SETS);
    if (places.isError) out.push("cities");
    if (districtSource.isError) out.push("districts");
    if (members.failed) out.push("owners");
    if (companyPage.isError) out.push("companies");
    return out;
  }, [crm.data, crm.isError, places.isError, districtSource.isError, members.failed, companyPage.isError]);

  const { refetch: refetchCrm } = crm;
  const { refetch: refetchPlaces } = places;
  const { refetch: refetchDistricts } = districtSource;
  const { reload: reloadFields } = fields;
  const { reload: reloadMembers } = members;
  const { refetch: refetchCompanies } = companyPage;
  const fieldsFailed = fields.failed;
  const retry = useCallback(() => {
    if (failed.some((kind) => CRM_OPTION_SETS.includes(kind as CrmOptionSet))) void refetchCrm();
    if (failed.includes("cities")) void refetchPlaces();
    if (failed.includes("districts")) void refetchDistricts();
    if (failed.includes("owners")) reloadMembers();
    if (failed.includes("companies")) void refetchCompanies();
    if (fieldsFailed) void reloadFields();
  }, [failed, fieldsFailed, refetchCrm, refetchPlaces, refetchDistricts, reloadFields, reloadMembers, refetchCompanies]);

  const cities = places.data?.cities ?? NO_CITIES;
  const districts = districtSource.data?.districts ?? NO_DISTRICTS;
  const companyItems = companyPage.data?.items;
  const listedCompanies = useMemo(() => (companyItems ?? []).map((company) => ({ value: company.id, label: company.name })), [companyItems]);
  const unlistedCompanyIds = useMemo(() => unlistedIdsOf(listedCompanies, companyIds), [companyIds, listedCompanies]);
  const unlistedCompanyNames = useLeadCompanyNames(unlistedCompanyIds, readsCompanies && companyPage.isSuccess);
  const companies = useMemo(() => withUnlisted(listedCompanies, unlistedCompanyIds, unlistedCompanyNames), [listedCompanies, unlistedCompanyIds, unlistedCompanyNames]);
  const listedCampaigns = crm.data?.campaigns ?? NO_OPTIONS;
  const unlistedCampaignIds = useMemo(() => unlistedIdsOf(listedCampaigns, campaignIds), [campaignIds, listedCampaigns]);
  const unlistedCampaignNames = useCampaignNames(workspaceId, unlistedCampaignIds, crm.isSuccess);
  const campaigns = useMemo(() => withUnlisted(listedCampaigns, unlistedCampaignIds, unlistedCampaignNames), [listedCampaigns, unlistedCampaignIds, unlistedCampaignNames]);
  return useMemo(
    () => ({
      campaigns,
      stages: crm.data?.stages ?? NO_OPTIONS,
      labels: crm.data?.labels ?? NO_OPTIONS,
      companies,
      cities,
      districts,
      members: members.names,
      definitions,
      customFields,
      classification,
      readsAddresses,
      readsCompanies,
      pending,
      failed,
      fieldsFailed,
      retry,
    }),
    [crm.data, campaigns, companies, cities, districts, members.names, definitions, customFields, classification, readsAddresses, readsCompanies, pending, failed, fieldsFailed, retry],
  );
}
