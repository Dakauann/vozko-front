export type RequiredVariableSource = "template" | "workflow" | "agent";

export interface RequiredVariable {
  key: string;
  label: string;
  source: RequiredVariableSource;
  index?: number;
}

export interface CampaignContactValues {
  variables?: (string | undefined | null)[] | Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface MissingVariable {
  variable: RequiredVariable;
  contacts: number;
  suggestion?: string;
}

export interface MissingVariablesReport {
  contacts: number;
  variables: MissingVariable[];
}

const MAX_SUGGESTION_DISTANCE = 2;

export function requiredVariablesOf(
  templateVariables: string[],
  workflowKeys: string[],
  agentKeys: { key: string; label: string }[],
): RequiredVariable[] {
  const required: RequiredVariable[] = templateVariables.map((placeholder, index) => ({
    key: placeholder,
    label: placeholder,
    source: "template",
    index,
  }));
  const seen = new Set<string>();
  for (const key of workflowKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    required.push({ key, label: key, source: "workflow" });
  }
  for (const { key, label } of agentKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    required.push({ key, label, source: "agent" });
  }
  return required;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function templateValue(contact: CampaignContactValues, index: number): unknown {
  const vars = contact.variables;
  if (!vars) return undefined;
  return Array.isArray(vars) ? vars[index] : vars[String(index)];
}

export function missingVariablesOf(
  contact: CampaignContactValues | undefined,
  required: RequiredVariable[],
): RequiredVariable[] {
  if (!contact) return required;
  return required.filter((variable) =>
    variable.source === "template"
      ? isBlank(templateValue(contact, variable.index ?? 0))
      : isBlank(contact.metadata?.[variable.key]),
  );
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

export function similarColumn(key: string, columns: string[]): string | undefined {
  const wanted = key.toLowerCase();
  let best: { column: string; distance: number } | undefined;
  for (const column of columns) {
    if (column === key) continue;
    const distance = editDistance(wanted, column.toLowerCase());
    if (distance <= MAX_SUGGESTION_DISTANCE && (!best || distance < best.distance)) {
      best = { column, distance };
    }
  }
  return best?.column;
}

export function missingVariablesReport(
  contacts: (CampaignContactValues | undefined)[],
  required: RequiredVariable[],
  columns: string[],
): MissingVariablesReport {
  const counts = new Map<RequiredVariable, number>();
  let incomplete = 0;
  for (const contact of contacts) {
    const missing = missingVariablesOf(contact, required);
    if (missing.length === 0) continue;
    incomplete += 1;
    for (const variable of missing) counts.set(variable, (counts.get(variable) ?? 0) + 1);
  }
  const variables = required
    .filter((variable) => counts.has(variable))
    .map((variable) => ({
      variable,
      contacts: counts.get(variable) ?? 0,
      suggestion: variable.source === "template" ? undefined : similarColumn(variable.key, columns),
    }));
  return { contacts: incomplete, variables };
}
