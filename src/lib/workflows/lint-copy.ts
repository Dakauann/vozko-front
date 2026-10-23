import type { LintIssue, NodeDefinition } from "./types";

export interface LintTranslator {
  (key: string, values?: Record<string, string>): string;
  has: (key: string) => boolean;
}

export interface LintSubjects {
  nodeLabel?: (nodeId: string) => string | undefined;
  fieldLabel?: (nodeId: string, field: string) => string | undefined;
  outputLabel?: (nodeId: string, output: string) => string | undefined;
}

export interface LocalizedLintIssue extends LintIssue {
  title: string;
  fix: string;
  technical: string | null;
}

export function configFieldLabel(definition: NodeDefinition | undefined, key: string): string | undefined {
  return definition?.configSchema?.find((field) => field.key === key)?.label || undefined;
}

function subjectValues(t: LintTranslator, issue: LintIssue, subjects: LintSubjects): Record<string, string> {
  const quoted = (label: string) => t("lintCopy.quoted", { label });
  const nodeLabel = issue.nodeId ? subjects.nodeLabel?.(issue.nodeId) : undefined;
  const fieldLabel = issue.field ? (subjects.fieldLabel?.(issue.nodeId ?? "", issue.field) ?? issue.field) : undefined;
  const outputLabel = issue.path ? (subjects.outputLabel?.(issue.nodeId ?? "", issue.path) ?? issue.path) : undefined;
  return {
    node: nodeLabel ? quoted(nodeLabel) : t("lintCopy.someNode"),
    field: fieldLabel ? quoted(fieldLabel) : t("lintCopy.someField"),
    output: outputLabel ? t("lintCopy.namedOutput", { label: quoted(outputLabel) }) : t("lintCopy.someOutput"),
    ref: issue.path ? `{{${issue.path}}}` : t("lintCopy.someData"),
  };
}

function localizedLintIssue(t: LintTranslator, issue: LintIssue, subjects: LintSubjects): LocalizedLintIssue {
  const key = `lint.${issue.code}`;
  if (!t.has(`${key}.title`) || !t.has(`${key}.fix`)) {
    return { ...issue, title: t("lintCopy.unknownTitle"), fix: t("lintCopy.unknownFix"), technical: issue.message };
  }
  const values = subjectValues(t, issue, subjects);
  return { ...issue, title: t(`${key}.title`, values), fix: t(`${key}.fix`, values), technical: null };
}

export function localizedLintIssues(t: LintTranslator, issues: LintIssue[], subjects: LintSubjects = {}): LocalizedLintIssue[] {
  return issues.map((issue) => localizedLintIssue(t, issue, subjects));
}
