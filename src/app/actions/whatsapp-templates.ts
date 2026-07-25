import type {
  CreateTemplatePayload,
  SendTemplatePayload,
  TemplateListMeta,
  TemplateListParams,
  TemplateListResponse,
  UpdateHeaderMediaPayload,
  WhatsAppTemplate,
} from '@/lib/whatsapp-templates/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_TEMPLATE_META: TemplateListMeta = {
  page: 1,
  pageSize: 0,
  totalPages: 1,
  totalItems: 0,
};

function normalizeTemplateList(payload?: TemplateListResponse | WhatsAppTemplate[] | null) {
  const meta: TemplateListMeta = { ...DEFAULT_TEMPLATE_META };
  let templates: WhatsAppTemplate[] = [];

  if (!payload) {
    return { templates, meta };
  }

  if (Array.isArray(payload)) {
    templates = payload;
  } else {
    if (Array.isArray(payload.data)) {
      templates = payload.data as WhatsAppTemplate[];
    } else if (Array.isArray(payload.items)) {
      templates = payload.items as WhatsAppTemplate[];
    } else if (Array.isArray(payload.templates)) {
      templates = payload.templates as WhatsAppTemplate[];
    }

    if (payload.meta) {
      meta.page = payload.meta.page ?? meta.page;
      meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
      meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
      meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
    }
  }

  if (!meta.pageSize) {
    meta.pageSize = templates.length;
  }

  if (!meta.totalItems) {
    meta.totalItems = templates.length;
  }

  return { templates, meta };
}

export async function listWhatsAppTemplatesAction(params?: TemplateListParams) {
  const queryParams = new URLSearchParams();
  if (params?.wabaId) queryParams.set('wabaId', params.wabaId);
  if (params?.businessPhoneId) queryParams.set('businessPhoneId', params.businessPhoneId);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.category) queryParams.set('category', params.category);
  if (params?.language) queryParams.set('language', params.language);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
  if (params?.search) queryParams.set('search', params.search);

  const queryString = queryParams.toString();
  const endpoint = `/whatsapp/templates${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient<TemplateListResponse>(endpoint, {
    method: 'GET',
  });

  if (response.error) {
    return {
      templates: [] as WhatsAppTemplate[],
      meta: DEFAULT_TEMPLATE_META,
      error: response.error.message,
    };
  }

  const { templates, meta } = normalizeTemplateList(response.data ?? null);

  return { templates, meta };
}

export async function getWhatsAppTemplateByIdAction(templateId: string) {
  const response = await apiClient<WhatsAppTemplate>(`/whatsapp/templates/${templateId}`, {
    method: 'GET',
  });

  if (response.error) {
    return { template: null, error: response.error.message };
  }

  return { template: response.data ?? null };
}

export async function createWhatsAppTemplateAction(payload: CreateTemplatePayload) {
  const response = await apiClient<WhatsAppTemplate>('/whatsapp/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  console.log("Creating template: ", payload, " Response: ", response);

  if (response.error) {
    return { template: null, error: response.error.message };
  }

  return { template: response.data ?? null, error: null };
}

export async function syncAllWhatsAppTemplatesAction(businessPhoneId: string) {
  const response = await apiClient<{ count: number; templates: WhatsAppTemplate[] }>(`/whatsapp/templates/sync?businessPhoneId=${encodeURIComponent(businessPhoneId)}`, {
    method: 'POST',
  });

  if (response.error) {
    return { success: false, error: response.error.message, count: 0, templates: [] };
  }

  return {
    success: true,
    error: null,
    count: response.data?.count ?? 0,
    templates: response.data?.templates ?? [],
  };
}

export async function syncWhatsAppTemplateByIdAction(templateId: string) {
  const response = await apiClient<WhatsAppTemplate>(`/whatsapp/templates/${templateId}/sync`, {
    method: 'POST',
  });

  if (response.error) {
    return { success: false, template: null, error: response.error.message };
  }

  return { success: true, template: response.data ?? null, error: null };
}

interface SendTemplateResponse {
  message: string;
  messageId?: string;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  responseStatus?: number;
}

export async function sendWhatsAppTemplateMessageAction(payload: SendTemplatePayload) {
  const response = await apiClient<SendTemplateResponse>('/whatsapp/templates/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const debugInfo = response.data ? {
    requestPayload: response.data.requestPayload ?? null,
    responsePayload: response.data.responsePayload ?? null,
    responseStatus: response.data.responseStatus ?? null,
    serverMessage: response.data.message ?? null,
  } : null;

  if (response.error) {
    return { success: false, messageId: null, error: response.error.message, debugInfo };
  }

  const hasError = response.data?.message?.startsWith('Failed');
  return {
    success: !hasError,
    messageId: response.data?.messageId ?? null,
    error: hasError ? response.data?.message ?? null : null,
    debugInfo,
  };
}

export async function updateWhatsAppTemplateHeaderMediaAction(
  templateId: string,
  payload: UpdateHeaderMediaPayload
) {
  const response = await apiClient<{ message: string }>(`/whatsapp/templates/${templateId}/header-media`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: true, error: null };
}

export async function uploadTemplateHeaderMediaAction(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient<{ url: string; fileName?: string; contentType?: string }>(
    "/whatsapp/templates/header-media/upload",
    {
      method: "POST",
      body: formData,
    }
  );

  if (response.error) {
    return { success: false as const, url: null, error: response.error.message };
  }

  return { success: true as const, url: response.data?.url ?? null, error: null };
}

export async function replicateWhatsAppTemplateAction(
  templateId: string,
  targetBusinessPhoneId: string
) {
  const response = await apiClient<{
    id: string;
    externalId: string;
    name: string;
    status: string;
  }>(`/whatsapp/templates/${templateId}/replicate`, {
    method: 'POST',
    body: JSON.stringify({ targetBusinessPhoneId }),
  });

  if (response.error) {
    return { success: false, template: null, error: response.error.message };
  }

  return { success: true, template: response.data ?? null, error: null };
}

export async function listWhatsAppTemplatesAdminAction(params?: TemplateListParams) {
  const queryParams = new URLSearchParams();
  if (params?.wabaId) queryParams.set('wabaId', params.wabaId);
  if (params?.businessPhoneId) queryParams.set('businessPhoneId', params.businessPhoneId);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.category) queryParams.set('category', params.category);
  if (params?.language) queryParams.set('language', params.language);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
  if (params?.search) queryParams.set('search', params.search);

  const queryString = queryParams.toString();
  const endpoint = `/admin/whatsapp/templates${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient<TemplateListResponse>(endpoint, {
    method: 'GET',
  });

  if (response.error) {
    return {
      templates: [] as WhatsAppTemplate[],
      meta: DEFAULT_TEMPLATE_META,
      error: response.error.message,
    };
  }

  const { templates, meta } = normalizeTemplateList(response.data ?? null);

  return { templates, meta };
}

export async function getWhatsAppTemplateByIdAdminAction(templateId: string) {
  const response = await apiClient<WhatsAppTemplate>(`/admin/whatsapp/templates/${templateId}`, {
    method: 'GET',
  });

  if (response.error) {
    return { template: null, error: response.error.message };
  }

  return { template: response.data ?? null };
}
