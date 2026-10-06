import { pathForScreen } from "@/lib/navigation/routes";

import type { DocumentOf, StudioDocument, StudioKind } from "./document";
import { parseDocument, type DocumentIssue } from "./validate";

export interface StudioProject<D extends StudioDocument = StudioDocument> {
  id: string;
  kind: StudioKind;
  name: string;
  document: D;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioProjectSummary {
  id: string;
  kind: StudioKind;
  name: string;
  version: number;
  updatedAt: string;
}

export interface StudioProjectPage {
  items: StudioProjectSummary[];
  total: number;
}

export interface StudioProjectQuery {
  kind?: StudioKind;
  limit?: number;
  offset?: number;
}

export interface StudioChange {
  name?: string;
  document?: StudioDocument;
}

export const VERSION_CONFLICT = "version_conflict";
export const INVALID_DOCUMENT = "invalid_document";

export function readProject<K extends StudioKind>(project: StudioProject, kind: K): { ok: true; project: StudioProject<DocumentOf<K>> } | { ok: false; issue: DocumentIssue } {
  if (project.kind !== kind) return { ok: false, issue: { field: "kind", code: "unknown" } };
  const parsed = parseDocument(kind, project.document);
  if (!parsed.ok) return { ok: false, issue: parsed.issue };
  return { ok: true, project: { ...project, document: parsed.document as DocumentOf<K> } };
}

export function summaryOf(project: StudioProject): StudioProjectSummary {
  return { id: project.id, kind: project.kind, name: project.name, version: project.version, updatedAt: project.updatedAt };
}

export function editorPathFor(project: Pick<StudioProjectSummary, "id" | "kind">): string | null {
  return pathForScreen(project.kind === "image" ? "studio_image" : "studio_video", { projectId: project.id });
}
