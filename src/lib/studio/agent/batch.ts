export const MAX_AGENT_OPERATIONS = 40;

export type AgentFocus =
  | { kind: "clip"; clipId: string }
  | { kind: "track"; trackId: string; atMs?: number }
  | { kind: "time"; atMs: number }
  | { kind: "frame"; x: number; y: number; w?: number; h?: number }
  | { kind: "layer"; layerId: string }
  | { kind: "artboard"; artboardId: string }
  | { kind: "canvas" };

export type AgentOutcome<D> =
  | { ok: true; document: D; created?: string[]; changed?: string[]; copies?: Record<string, string>; notes?: string[]; focus: AgentFocus; label: string; seekMs?: number; select?: string[] }
  | { ok: false; reason: string };

export interface AgentStep<D> {
  document: D;
  focus: AgentFocus;
  label: string;
  seekMs?: number;
  select?: string[];
}

export interface BatchFailure {
  index: number;
  op: string;
  reason: string;
}

export type BatchPlan<D> =
  | { ok: true; steps: AgentStep<D>[]; final: D; created: Record<string, string[]>; changed: string[]; copies: Record<string, string>; notes: string[] }
  | { ok: false; index: number; op: string; reason: string; failures: BatchFailure[]; skipped: number[] };

interface WithRef {
  op: string;
  ref?: string;
}

const MIN_ID_PREFIX = 6;

type IdResolution = { ok: true; ids: string[]; note?: string } | { ok: false; ref: string } | { ok: false; reason: string };

function resolveId(value: string, refs: ReadonlyMap<string, string[]>, known: ReadonlySet<string> | null): IdResolution {
  if (value.startsWith("@")) {
    const found = refs.get(value.slice(1));
    return found ? { ok: true, ids: found } : { ok: false, ref: value };
  }
  if (!known || known.has(value)) return { ok: true, ids: [value] };
  const ref = refs.get(value);
  if (ref) return { ok: true, ids: ref, note: `${value} entendido como @${value}` };
  if (value.length < MIN_ID_PREFIX) return { ok: true, ids: [value] };
  const matches = [...known].filter((id) => id.startsWith(value));
  if (matches.length === 1) return { ok: true, ids: matches, note: `${value} entendido como ${matches[0]}` };
  if (matches.length > 1) return { ok: false, reason: `o id ${value} combina com mais de um: ${matches.slice(0, 5).join(", ")}; use o id completo` };
  return { ok: true, ids: [value] };
}

function resolveRef(value: unknown, refs: ReadonlyMap<string, string[]>, known: ReadonlySet<string> | null, notes: string[]): { ok: true; value: unknown } | { ok: false; ref: string } | { ok: false; reason: string } {
  if (typeof value === "string") {
    const resolved = resolveId(value, refs, known);
    if (!resolved.ok) return resolved;
    if (resolved.note) notes.push(resolved.note);
    return { ok: true, value: resolved.ids[0] };
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      if (typeof item !== "string") {
        out.push(item);
        continue;
      }
      const resolved = resolveId(item, refs, known);
      if (!resolved.ok) return resolved;
      if (resolved.note) notes.push(resolved.note);
      out.push(...(item.startsWith("@") || resolved.note ? resolved.ids : [resolved.ids[0]]));
    }
    return { ok: true, value: out };
  }
  return { ok: true, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripped(value: unknown): unknown {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (!isRecord(value)) return value ?? undefined;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    const kept = stripped(field);
    if (kept !== undefined) out[key] = kept;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

export function normalizeOperation<O extends WithRef>(raw: O, idFields: readonly string[]): O {
  const op: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "op") {
      op[key] = value;
      continue;
    }
    const kept = Array.isArray(value) && value.length === 0 && idFields.includes(key) ? undefined : stripped(value);
    if (kept !== undefined) op[key] = kept;
  }
  for (const field of idFields) {
    const single = field.endsWith("_ids") ? field.slice(0, -1) : null;
    const list = op[field];
    if (single && op[single] === undefined && Array.isArray(list) && list.length === 1) op[single] = list[0];
  }
  return op as O;
}

function crashReason(error: unknown): string {
  return `o editor falhou nesta operação (${error instanceof Error ? error.message : String(error)}); tente de outro jeito ou leia o projeto de novo`;
}

export function planBatch<D, O extends WithRef>(
  base: D,
  operations: readonly O[],
  apply: (doc: D, op: O) => AgentOutcome<D>,
  idFields: readonly string[],
  knownIds?: (doc: D) => Iterable<string>,
): BatchPlan<D> {
  const refs = new Map<string, string[]>();
  const named = new Set<string>();
  const copies: Record<string, string> = {};
  const steps: AgentStep<D>[] = [];
  const changed = new Set<string>();
  const notes: string[] = [];
  const failures: BatchFailure[] = [];
  const skipped: number[] = [];
  const failedRefs = new Set<string>();
  let document = base;
  operations.forEach((raw, index) => {
    const op = normalizeOperation(raw, idFields) as O & Record<string, unknown>;
    const fail = (reason: string) => {
      failures.push({ index, op: raw.op, reason });
      if (raw.ref) failedRefs.add(raw.ref);
    };
    const known = knownIds ? new Set(knownIds(document)) : null;
    const resolutionNotes: string[] = [];
    for (const field of idFields) {
      if (!(field in op)) continue;
      const resolved = resolveRef(op[field], refs, known, resolutionNotes);
      if (!resolved.ok && "reason" in resolved) {
        fail(resolved.reason);
        return;
      }
      if (!resolved.ok) {
        if (failedRefs.has(resolved.ref.slice(1))) {
          skipped.push(index);
          if (raw.ref) failedRefs.add(raw.ref);
        } else fail(`a referência ${resolved.ref} não foi criada antes neste lote`);
        return;
      }
      (op as Record<string, unknown>)[field] = resolved.value;
    }
    if (raw.ref && (refs.has(raw.ref) || failedRefs.has(raw.ref))) {
      fail(`a referência ${raw.ref} já foi usada neste lote; dê outro nome`);
      return;
    }
    let outcome: AgentOutcome<D>;
    try {
      outcome = apply(document, op);
    } catch (error) {
      outcome = { ok: false, reason: crashReason(error) };
    }
    if (!outcome.ok) {
      fail(outcome.reason);
      return;
    }
    document = outcome.document;
    if (raw.ref && outcome.created && outcome.created.length > 0) {
      refs.set(raw.ref, outcome.created);
      named.add(raw.ref);
    }
    for (const [source, copy] of Object.entries(outcome.copies ?? {})) {
      copies[source] = copy;
      if (raw.ref) refs.set(`${raw.ref}/${source}`, [copy]);
    }
    for (const id of [...(outcome.created ?? []), ...(outcome.changed ?? [])]) changed.add(id);
    for (const note of [...resolutionNotes, ...(outcome.notes ?? [])]) notes.push(`operação ${index + 1} (${raw.op}): ${note}`);
    steps.push({ document, focus: outcome.focus, label: outcome.label, seekMs: outcome.seekMs, select: outcome.select });
  });
  if (failures.length > 0) return { ok: false, index: failures[0].index, op: failures[0].op, reason: failures[0].reason, failures, skipped };
  return { ok: true, steps, final: document, created: Object.fromEntries([...refs].filter(([ref]) => named.has(ref))), changed: [...changed], copies, notes };
}

export type StepCheck<D, I> = (document: D) => { ok: true } | { ok: false; issue: I };

export function firstInvalidStep<D, I>(steps: readonly AgentStep<D>[], check: StepCheck<D, I>): { index: number; issue: I } | null {
  for (const [index, step] of steps.entries()) {
    const result = check(step.document);
    if (!result.ok) return { index, issue: result.issue };
  }
  return null;
}

export type ParsedOperations<O> = { ok: true; operations: O[] } | { ok: false; reason: string };

export function parseOperations<O extends WithRef>(args: unknown, allowed: readonly string[]): ParsedOperations<O> {
  const list = args && typeof args === "object" ? (args as { operations?: unknown }).operations : undefined;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_AGENT_OPERATIONS) {
    return { ok: false, reason: `envie de 1 a ${MAX_AGENT_OPERATIONS} operações` };
  }
  for (const [index, item] of list.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, reason: `a operação ${index + 1} não é um objeto` };
    const op = (item as { op?: unknown }).op;
    if (typeof op !== "string" || !allowed.includes(op)) return { ok: false, reason: `a operação ${index + 1} (${String(op)}) não existe neste editor` };
  }
  return { ok: true, operations: list as O[] };
}
