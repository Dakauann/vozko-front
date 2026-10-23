import type { Block, Document, Settings } from "../types";

export interface StepPatch {
  op: string;
  focus?: string;
  settings?: Settings;
  order?: string[];
  blocks?: Record<string, Block>;
}

export interface Envelope {
  subject: string;
  preheader: string;
}

export interface EnvelopeEdit {
  base: Envelope;
  next: Envelope;
}

export interface EditPayload {
  base: Document;
  steps: StepPatch[];
  envelope?: EnvelopeEdit;
}

export interface EmailStep {
  document: Document;
  focus: string | null;
  op: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDocument(value: unknown): value is Document {
  return isRecord(value) && typeof value.version === "number" && isRecord(value.settings) && Array.isArray(value.blocks);
}

function isEnvelope(value: unknown): value is Envelope {
  return isRecord(value) && typeof value.subject === "string" && typeof value.preheader === "string";
}

function isEnvelopeEdit(value: unknown): value is EnvelopeEdit {
  return isRecord(value) && isEnvelope(value.base) && isEnvelope(value.next);
}

function isPatch(value: unknown): value is StepPatch {
  if (!isRecord(value) || typeof value.op !== "string") return false;
  if (value.focus !== undefined && typeof value.focus !== "string") return false;
  if (value.settings !== undefined && !isRecord(value.settings)) return false;
  if (value.order !== undefined && !(Array.isArray(value.order) && value.order.every((id) => typeof id === "string"))) return false;
  return value.blocks === undefined || isRecord(value.blocks);
}

function rebuilt(previous: Document, patch: StepPatch): Document | null {
  const known = new Map(previous.blocks.map((block) => [block.id, block]));
  const order = patch.order ?? previous.blocks.map((block) => block.id);
  const blocks: Block[] = [];
  for (const id of order) {
    const block = patch.blocks?.[id] ?? known.get(id);
    if (!block) return null;
    blocks.push(block);
  }
  return { version: previous.version, settings: patch.settings ?? previous.settings, blocks };
}

export function editPayloadOf(value: unknown): EditPayload | null {
  if (!isRecord(value) || !isDocument(value.base) || !Array.isArray(value.steps) || !value.steps.every(isPatch)) return null;
  const envelope = value.envelope;
  if (envelope !== undefined && !isEnvelopeEdit(envelope)) return null;
  const payload: EditPayload = { base: value.base, steps: value.steps, ...(envelope ? { envelope } : {}) };
  let current: Document | null = payload.base;
  for (const patch of payload.steps) {
    current = current && rebuilt(current, patch);
  }
  return current ? payload : null;
}

export function stepDocuments(payload: EditPayload): EmailStep[] {
  const steps: EmailStep[] = [];
  let previous = payload.base;
  for (const patch of payload.steps) {
    const document = rebuilt(previous, patch) ?? previous;
    steps.push({ document, focus: patch.focus ?? null, op: patch.op });
    previous = document;
  }
  return steps;
}
