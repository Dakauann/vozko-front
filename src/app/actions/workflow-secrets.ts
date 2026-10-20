import { apiClient } from "@/lib/api/browser-client";
import type {
  WorkflowSecret,
  WorkflowSecretListResponse,
  WorkflowSecretResponse,
} from "@/lib/workflow-secrets/types";

function toSecret(response: WorkflowSecretResponse): WorkflowSecret {
  return { name: response.name, updatedAt: response.updated_at, updatedBy: response.updated_by };
}

function secretPath(name: string): string {
  return `/workflow-secrets/${encodeURIComponent(name)}`;
}

export async function listWorkflowSecretsAction() {
  const response = await apiClient<WorkflowSecretListResponse>("/workflow-secrets", { method: "GET" });
  if (response.error) {
    return { secrets: [] as WorkflowSecret[], error: response.error.message, code: response.error.code, status: response.error.status };
  }
  return { secrets: (response.data?.secrets ?? []).map(toSecret) };
}

export async function putWorkflowSecretAction(name: string, value: string) {
  const response = await apiClient<WorkflowSecretResponse>(secretPath(name), {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  if (response.error) {
    return { secret: null as WorkflowSecret | null, error: response.error.message, code: response.error.code, status: response.error.status };
  }
  return { secret: response.data ? toSecret(response.data) : null };
}

export async function deleteWorkflowSecretAction(name: string) {
  const response = await apiClient<void>(secretPath(name), { method: "DELETE" });
  if (response.error) {
    return { error: response.error.message, code: response.error.code, status: response.error.status };
  }
  return {};
}
