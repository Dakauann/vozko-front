import { apiClient } from "@/lib/api/browser-client";
import type { StudioDocument, StudioKind } from "@/lib/studio/document";
import type { ExportedVideo } from "@/lib/studio/export";
import type { CapabilityReport } from "@/lib/studio/telemetry";
import { ifMatchHeader, isVersionConflict, type VersionedSaveResult } from "@/lib/api/versioned-save";
import {
  type StudioChange,
  type StudioProject,
  type StudioProjectPage,
  type StudioProjectQuery,
} from "@/lib/studio/project";

import { isActionError, settleResult, type ActionError, type ActionResult } from "./action-result";

const PROJECTS_PATH = "/studio/projects";
const CAPABILITIES_PATH = "/studio/capabilities";

function projectPath(id: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(id)}`;
}

export type StudioSaveResult = VersionedSaveResult<"project", StudioProject, ActionError>;

export async function listStudioProjectsAction(query: StudioProjectQuery = {}): Promise<ActionResult<StudioProjectPage>> {
  const params = new URLSearchParams();
  if (query.kind) params.set("kind", query.kind);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const search = params.toString();
  return settleResult(await apiClient<StudioProjectPage>(search ? `${PROJECTS_PATH}?${search}` : PROJECTS_PATH, { method: "GET" }));
}

export async function createStudioProjectAction(input: { kind: StudioKind; name: string; document: StudioDocument }): Promise<ActionResult<StudioProject>> {
  return settleResult(await apiClient<StudioProject>(PROJECTS_PATH, { method: "POST", body: JSON.stringify(input) }));
}

export async function getStudioProjectAction(id: string): Promise<ActionResult<StudioProject>> {
  return settleResult(await apiClient<StudioProject>(projectPath(id), { method: "GET" }));
}

export async function saveStudioProjectAction(id: string, version: number, change: StudioChange, options: { keepalive?: boolean } = {}): Promise<StudioSaveResult> {
  const result = settleResult(
    await apiClient<StudioProject>(projectPath(id), {
      method: "PATCH",
      headers: ifMatchHeader(version),
      body: JSON.stringify(change),
      keepalive: options.keepalive,
    }),
  );
  if (!isActionError(result)) return { status: "saved", project: result.data };
  if (!isVersionConflict(result)) return { status: "failed", error: result };
  const current = await getStudioProjectAction(id);
  if (isActionError(current)) return { status: "failed", error: current };
  return { status: "conflict", current: current.data };
}

export async function reportStudioCapabilitiesAction(sessionId: string, report: CapabilityReport, options: { keepalive?: boolean } = {}): Promise<ActionResult<true>> {
  const path = `${CAPABILITIES_PATH}/${encodeURIComponent(sessionId)}`;
  return settleResult(await apiClient<true>(path, { method: "PUT", body: JSON.stringify(report), keepalive: options.keepalive }), true);
}

export async function archiveStudioProjectAction(id: string): Promise<ActionResult<true>> {
  return settleResult(await apiClient<true>(projectPath(id), { method: "DELETE" }), true);
}

export async function saveStudioExportAction(id: string, video: Blob): Promise<ActionResult<ExportedVideo>> {
  const form = new FormData();
  form.append("video", new File([video], "export.mp4", { type: "video/mp4" }));
  return settleResult(await apiClient<ExportedVideo>(`${projectPath(id)}/exports`, { method: "POST", body: form }));
}
