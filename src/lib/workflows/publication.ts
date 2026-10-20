import { codedErrorMessage, type CodedTranslator } from "@/lib/api/coded-error";

import { localizedLintIssues, type LintSubjects } from "./lint-copy";
import type { LintIssue, Workflow, WorkflowStatus } from "./types";

export type PublicationFacts = Pick<Workflow, "status" | "publishedVersion" | "hasUnpublishedChanges">;

export interface PublicationChip {
  status: WorkflowStatus;
  version: number | null;
  unpublishedChanges: boolean;
}

export function publishedVersionOf(facts: Pick<Workflow, "publishedVersion">): number | null {
  const version = facts.publishedVersion;
  return typeof version === "number" && Number.isInteger(version) && version > 0 ? version : null;
}

export function publicationChip(facts: PublicationFacts): PublicationChip {
  const version = publishedVersionOf(facts);
  return {
    status: facts.status,
    version,
    unpublishedChanges: version !== null && facts.hasUnpublishedChanges === true,
  };
}

export function versionTag(version: number): string {
  return `v${version}`;
}

export function workflowOptionLabel(wf: Pick<Workflow, "name" | "publishedVersion">): string {
  const version = publishedVersionOf(wf);
  return version === null ? wf.name : `${wf.name} · ${versionTag(version)}`;
}

export type LiveVersionMark = "live" | "paused";

export function liveVersionMark(version: number, facts: PublicationFacts): LiveVersionMark | null {
  if (publishedVersionOf(facts) !== version) return null;
  if (facts.status === "active") return "live";
  if (facts.status === "paused") return "paused";
  return null;
}

export type PublishStep = "save" | "publish";

export function publishSteps(draft: { saved: boolean; dirty: boolean }): PublishStep[] {
  return draft.saved && !draft.dirty ? ["publish"] : ["save", "publish"];
}

export const NOT_PUBLISHABLE = "workflow_not_publishable";

export interface PublishFailure {
  message: string;
  code?: string;
  status?: number;
  detail?: string;
  issues?: LintIssue[];
}

export interface PublishTranslator extends CodedTranslator {
  (key: string, values?: Record<string, string | number>): string;
}

const ISSUE_SEVERITIES: readonly string[] = ["blocking", "advisory", "info"];

function lintIssueOf(raw: unknown): LintIssue | null {
  if (typeof raw !== "object" || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  const { code, severity, message } = entry;
  if (typeof code !== "string" || typeof severity !== "string" || !ISSUE_SEVERITIES.includes(severity) || typeof message !== "string") {
    return null;
  }
  const issue: LintIssue = { code, severity: severity as LintIssue["severity"], message };
  for (const key of ["nodeId", "field", "edgeRef", "path", "hint"] as const) {
    const value = entry[key];
    if (typeof value === "string" && value) issue[key] = value;
  }
  return issue;
}

function blockingIssuesOf(code: string | undefined, details: Record<string, unknown> | undefined): LintIssue[] | undefined {
  if (code !== NOT_PUBLISHABLE || !Array.isArray(details?.issues)) return undefined;
  return details.issues.flatMap((raw) => lintIssueOf(raw) ?? []);
}

function issueKey(issue: LintIssue): string {
  return `${issue.code}\u0000${issue.nodeId ?? ""}`;
}

export function mergeLintIssues(lint: LintIssue[], publish: readonly LintIssue[]): LintIssue[] {
  const known = new Set(lint.map(issueKey));
  const added = publish.filter((issue) => {
    const key = issueKey(issue);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  return added.length === 0 ? lint : [...lint, ...added];
}

export interface PublishAnswer {
  workflow: Workflow | null;
  failure?: PublishFailure;
}

export type PublishOutcome =
  | { ok: true; workflow: Workflow; version: number | null }
  | { ok: false; stage: "save" }
  | { ok: false; stage: "publish"; failure?: PublishFailure };

export async function runPublishFlow(input: {
  workflowId: string | null;
  dirty: boolean;
  save: () => Promise<Workflow | null>;
  publish: (workflowId: string) => Promise<PublishAnswer>;
}): Promise<PublishOutcome> {
  let workflowId = input.workflowId;
  for (const step of publishSteps({ saved: workflowId !== null, dirty: input.dirty })) {
    if (step === "save") {
      const saved = await input.save();
      if (!saved?.id) return { ok: false, stage: "save" };
      workflowId = saved.id;
      continue;
    }
    if (!workflowId) return { ok: false, stage: "save" };
    const answer = await input.publish(workflowId);
    if (answer.failure) return { ok: false, stage: "publish", failure: answer.failure };
    if (!answer.workflow) return { ok: false, stage: "publish" };
    return { ok: true, workflow: answer.workflow, version: publishedVersionOf(answer.workflow) };
  }
  return { ok: false, stage: "publish" };
}

export function publishFailureOf(error: {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}): PublishFailure {
  const detail = error.details?.detail;
  const issues = blockingIssuesOf(error.code, error.details);
  return {
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(error.status !== undefined ? { status: error.status } : {}),
    ...(typeof detail === "string" && detail ? { detail } : {}),
    ...(issues ? { issues } : {}),
  };
}

export function publishFailureCopy(
  failure: PublishFailure,
  translate: PublishTranslator,
  fallback: string,
  subjects: LintSubjects = {},
): { title: string; description?: string } {
  if (failure.issues && failure.issues.length > 0) {
    const [first] = localizedLintIssues(translate, failure.issues.slice(0, 1), subjects);
    return { title: translate("publication.notPublishable", { count: failure.issues.length }), description: first.title };
  }
  const title = codedErrorMessage(translate, failure, failure.message || fallback);
  return failure.detail && failure.detail !== title ? { title, description: failure.detail } : { title };
}

export function runDiffersFromCanvas(
  runVersion: number | null | undefined,
  facts: Pick<Workflow, "publishedVersion" | "hasUnpublishedChanges">,
  localEdits: boolean,
): boolean {
  if (localEdits) return true;
  if (typeof runVersion !== "number") return true;
  const published = publishedVersionOf(facts);
  return published !== runVersion || facts.hasUnpublishedChanges !== false;
}
