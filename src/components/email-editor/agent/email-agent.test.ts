import { describe, expect, it, vi } from "vitest";

import type { ScreenCommand } from "@/lib/aichat/screen";
import type { Envelope, StepPatch } from "@/lib/email-design/agent/steps";
import type { Block, Document } from "@/lib/email-design/types";

import { createEmailAgent, type EmailAgentDeps, type EnvelopePort } from "./email-agent";

const title: Block = { id: "title", kind: "heading", heading: { text: "Oi", level: 1 } };
const intro: Block = { id: "intro", kind: "text", text: { paragraphs: [{ runs: [{ text: "Olá" }] }] } };
const footer: Block = { id: "footer", kind: "footer", footer: { company_name: "Loja", address: "Rua A" } };
const base: Document = { version: 1, settings: {}, blocks: [title, intro, footer] };

function rig(overrides: Partial<EmailAgentDeps> = {}) {
  let document = base;
  const applied: string[] = [];
  const deps: EmailAgentDeps = {
    live: () => ({ document, selected: "intro", name: "Black Friday", readOnly: false }),
    store: {
      getState: () => ({
        document,
        inTransaction: false,
        applyAs: (group, operation) => {
          applied.push(group);
          document = operation();
        },
      }),
    },
    presence: { busy: vi.fn(), progress: vi.fn(), point: vi.fn(), rest: vi.fn() },
    locate: () => null,
    label: (op) => op,
    reduceMotion: () => true,
    hidden: () => false,
    capture: vi.fn(async () => ({ image: "data:image/jpeg;base64,AAAA", data: { slices: [], heights: { desktop: 900 } } })),
    ...overrides,
  };
  return { deps, applied, edit: (next: Document) => (document = next), current: () => document };
}

const retitled: Block = { ...title, heading: { ...title.heading, text: "Black Friday" } };
const button: Block = { id: "button-1", kind: "button", button: { label: "Ver ofertas", href: "https://loja.example.com" } };
const steps: StepPatch[] = [
  { op: "set", focus: "title", blocks: { title: retitled } },
  { op: "add", focus: "button-1", order: ["title", "intro", "button-1", "footer"], blocks: { "button-1": button } },
];
const editCommand: ScreenCommand = { id: "cmd-1", name: "edit", projectId: "d1", args: { base, steps } };

describe("createEmailAgent", () => {
  it("reads the live design with the selection and the name", async () => {
    const { deps } = rig();
    expect(await createEmailAgent(deps)({ id: "c", name: "read", projectId: "d1" })).toEqual({ ok: true, data: { document: base, selected: "intro", name: "Black Friday" } });
  });

  it("replays the steps as one undo group and answers with the live result", async () => {
    const { deps, applied, current } = rig();
    const reply = await createEmailAgent(deps)(editCommand);
    expect(reply.ok).toBe(true);
    expect(current().blocks.map((block) => block.id)).toEqual(["title", "intro", "button-1", "footer"]);
    expect(new Set(applied).size).toBe(1);
    expect(reply).toMatchObject({ data: { document: current(), conflicts: [], skipped: [] } });
  });

  it("keeps what the person changed meanwhile and reports the clash", async () => {
    const { deps, edit, current } = rig();
    edit({ ...base, blocks: [{ ...title, heading: { ...title.heading, text: "Minha versão" } }, intro, footer] });
    const reply = await createEmailAgent(deps)(editCommand);
    const heading = current().blocks[0];
    expect(heading.kind === "heading" && heading.heading.text).toBe("Minha versão");
    expect(reply).toMatchObject({ ok: true, data: { conflicts: ["blocks.title.heading.text"] } });
  });

  it("applies nothing when the turn never lets the edit go", async () => {
    const { deps, applied } = rig();
    expect(await createEmailAgent(deps)({ ...editCommand, claim: async () => false })).toMatchObject({ ok: false, error: { code: "expired" } });
    expect(applied).toHaveLength(0);
  });

  it("refuses to edit a design the person can only see, and refuses an unreadable batch", async () => {
    const readOnly = rig({ live: () => ({ document: base, selected: null, name: "x", readOnly: true }) });
    expect(await createEmailAgent(readOnly.deps)(editCommand)).toMatchObject({ ok: false, error: { code: "read_only" } });
    const { deps } = rig();
    expect(await createEmailAgent(deps)({ ...editCommand, args: { steps } })).toMatchObject({ ok: false, error: { code: "invalid_edit" } });
  });

  it("captures the rendered email with the block legend", async () => {
    const { deps } = rig();
    const reply = await createEmailAgent(deps)({ id: "c", name: "look", projectId: "d1", args: { html: "<p/>", device: "both", scheme: "light", marks: true } });
    expect(reply).toMatchObject({ ok: true, images: ["data:image/jpeg;base64,AAAA"] });
    expect(deps.capture).toHaveBeenCalledWith(expect.objectContaining({ devices: ["desktop", "mobile"], marks: true }), expect.arrayContaining([expect.objectContaining({ n: 1, id: "title" })]));
  });

  it("turns a capture the browser cannot draw into a coded refusal", async () => {
    const { deps } = rig({ capture: async () => Promise.reject(new Error("tainted")) });
    expect(await createEmailAgent(deps)({ id: "c", name: "look", projectId: "d1", args: { html: "<p/>", device: "mobile", scheme: "dark" } })).toMatchObject({ ok: false, error: { code: "capture_failed" } });
    expect(await createEmailAgent(deps)({ id: "c", name: "look", projectId: "d1", args: {} })).toMatchObject({ ok: false, error: { code: "invalid_look" } });
  });

  it("refuses commands that belong to other editors", async () => {
    const { deps } = rig();
    expect(await createEmailAgent(deps)({ id: "c", name: "export", projectId: "d1" })).toMatchObject({ ok: false, error: { code: "not_email" } });
  });
});

function campaignRig(typed?: Partial<Envelope>) {
  let envelope: Envelope = { subject: "Oferta para {{first_name|você}}", preheader: "Só hoje" };
  const applied: Array<{ next: Envelope; previous: Envelope }> = [];
  const port: EnvelopePort = {
    read: () => envelope,
    apply: (next, previous) => {
      applied.push({ next, previous });
      envelope = next;
    },
  };
  const base = rig({ envelope: port });
  if (typed) envelope = { ...envelope, ...typed };
  return { ...base, applied, envelope: () => envelope };
}

const envelopeEdit = (next: Partial<Envelope>) => ({
  base: { subject: "Oferta para {{first_name|você}}", preheader: "Só hoje" },
  next: { subject: "Oferta para {{first_name|você}}", preheader: "Só hoje", ...next },
});

describe("createEmailAgent on a campaign", () => {
  it("reads the subject and the preheader next to the document", async () => {
    const { deps } = campaignRig();
    expect(await createEmailAgent(deps)({ id: "c", name: "read", projectId: "c1" })).toEqual({
      ok: true,
      data: { document: base, selected: "intro", name: "Black Friday", subject: "Oferta para {{first_name|você}}", preheader: "Só hoje" },
    });
  });

  it("lands the document steps and the envelope live, and answers with both", async () => {
    const { deps, current, applied, envelope } = campaignRig();
    const reply = await createEmailAgent(deps)({ ...editCommand, args: { base, steps, envelope: envelopeEdit({ subject: "Última chance, {{first_name|cliente}}" }) } });
    expect(current().blocks.map((block) => block.id)).toEqual(["title", "intro", "button-1", "footer"]);
    expect(envelope()).toEqual({ subject: "Última chance, {{first_name|cliente}}", preheader: "Só hoje" });
    expect(applied).toEqual([{ next: envelope(), previous: { subject: "Oferta para {{first_name|você}}", preheader: "Só hoje" } }]);
    expect(reply).toEqual({ ok: true, data: { document: current(), conflicts: [], skipped: [], subject: "Última chance, {{first_name|cliente}}", preheader: "Só hoje" } });
  });

  it("keeps the subject the person typed meanwhile and reports the clash", async () => {
    const { deps, applied, envelope } = campaignRig({ subject: "O que ela digitou" });
    const reply = await createEmailAgent(deps)({ ...editCommand, args: { base, steps: [], envelope: envelopeEdit({ subject: "O da Elo", preheader: "Frete grátis" }) } });
    expect(envelope()).toEqual({ subject: "O que ela digitou", preheader: "Frete grátis" });
    expect(applied).toHaveLength(1);
    expect(reply).toMatchObject({ ok: true, data: { conflicts: ["subject"], subject: "O que ela digitou", preheader: "Frete grátis" } });
  });

  it("touches nothing when the envelope did not change", async () => {
    const { deps, applied } = campaignRig();
    await createEmailAgent(deps)({ ...editCommand, args: { base, steps: [], envelope: envelopeEdit({}) } });
    expect(applied).toHaveLength(0);
  });

  it("refuses an envelope on a design and a campaign batch without one", async () => {
    const design = rig();
    expect(await createEmailAgent(design.deps)({ ...editCommand, args: { base, steps, envelope: envelopeEdit({ subject: "x" }) } })).toMatchObject({ ok: false, error: { code: "invalid_edit" } });
    const campaign = campaignRig();
    expect(await createEmailAgent(campaign.deps)(editCommand)).toMatchObject({ ok: false, error: { code: "invalid_edit" } });
    expect(await createEmailAgent(campaign.deps)({ ...editCommand, args: { base, steps, envelope: { base: {}, next: {} } } })).toMatchObject({ ok: false, error: { code: "invalid_edit" } });
    expect(campaign.applied).toHaveLength(0);
  });
});
