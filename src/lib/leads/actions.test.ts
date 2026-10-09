import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import deMessages from "@/i18n/messages/de.json";
import type { CodedTranslator } from "@/lib/api/coded-error";

import {
  LEAD_ACTION_ERROR_CODES,
  LEAD_ACTION_FAILURE_CODES,
  LEAD_ACTION_SKIP_REASONS,
  isLeadSendAction,
  leadActionSkipRows,
  isRecordEdit,
  isTerminalAudience,
  isTerminalRun,
  leadActionErrorMessage,
  leadActionPreviewProgress,
  parseLeadActionPreview,
  parseLeadActionRun,
  parseLeadActionStart,
  parseLeadAudienceJob,
} from "./actions";

type Tree = { [key: string]: string | Tree };

function translator(messages: Tree, namespace: string): CodedTranslator {
  const lookup = (key: string): string | undefined => {
    let node: string | Tree | undefined = messages;
    for (const part of `${namespace}.${key}`.split(".")) {
      if (node === undefined || typeof node === "string") return undefined;
      node = node[part];
    }
    return typeof node === "string" ? node : undefined;
  };
  const t = ((key: string) => lookup(key) ?? key) as CodedTranslator;
  t.has = (key: string) => lookup(key) !== undefined;
  return t;
}

const LOCALES: [string, Tree][] = [
  ["pt", ptMessages as unknown as Tree],
  ["en", enMessages as unknown as Tree],
  ["es", esMessages as unknown as Tree],
  ["de", deMessages as unknown as Tree],
];

function translators(messages: Tree) {
  return [translator(messages, "leadsPage.bulk"), translator(messages, "leadsPage"), translator(messages, "customFields"), translator(messages, "selection")];
}

const PREVIEW = {
  id: "p-1",
  action: "classify",
  status: "done",
  result: { matched: 1204, expectedCount: 1204, fingerprint: "fp-1", selected: 1204, eligible: 1100, skipped: { unchanged: 104 } },
  updatedAt: "2026-10-08T12:00:00Z",
};

const RUN = {
  id: "r-1",
  action: "classify",
  status: "running",
  phase: "edit",
  actorId: "u-1",
  params: { key: "interesse", value: "matriculado" },
  result: { matched: 1204, selected: 1204, processed: 500, changed: 480, skipped: { unchanged: 20 } },
  createdAt: "2026-10-08T12:00:00Z",
};

const AUDIENCE = { id: "a-1", status: "pending", matched: 0, skipped: 0, startedAt: "2026-10-08T12:00:00Z", updatedAt: "2026-10-08T12:00:00Z" };

describe("lead action answers", () => {
  it("reads a preview", () => {
    expect(parseLeadActionPreview(PREVIEW)).toEqual(PREVIEW);
  });

  it("reads a preview with no skips as an empty tally", () => {
    const parsed = parseLeadActionPreview({ ...PREVIEW, result: { ...PREVIEW.result, skipped: undefined } });
    expect(parsed?.result.skipped).toEqual({});
  });

  it("refuses a preview without its fingerprint", () => {
    expect(parseLeadActionPreview({ ...PREVIEW, result: { ...PREVIEW.result, fingerprint: undefined } })).toBeNull();
    expect(parseLeadActionPreview({ ...PREVIEW, status: "lost" })).toBeNull();
    expect(parseLeadActionPreview(null)).toBeNull();
  });

  it("reads a run and knows when it is over", () => {
    const run = parseLeadActionRun(RUN);
    expect(run?.result.changed).toBe(480);
    expect(isTerminalRun(run!.status)).toBe(false);
    expect(isTerminalRun("done")).toBe(true);
    expect(isTerminalRun("failed")).toBe(true);
    expect(parseLeadActionRun({ ...RUN, status: "paused" })).toBeNull();
  });

  it("reads an audience job and knows when it is over", () => {
    expect(parseLeadAudienceJob(AUDIENCE)?.status).toBe("pending");
    expect(isTerminalAudience("pending")).toBe(false);
    expect(isTerminalAudience("done")).toBe(true);
    expect(parseLeadAudienceJob({ ...AUDIENCE, id: 3 })).toBeNull();
  });

  it("reads each start answer by what the action returns", () => {
    expect(parseLeadActionStart({ action: "classify", run: RUN })).toEqual({ action: "classify", run: parseLeadActionRun(RUN) });
    expect(parseLeadActionStart({ action: "meta_audience", audience: AUDIENCE })?.audience?.id).toBe("a-1");
    expect(parseLeadActionStart({ action: "export", report: { id: "j-1", status: "queued", kind: "leads" } })?.report?.id).toBe("j-1");
    expect(parseLeadActionStart({ action: "classify" })).toBeNull();
    expect(parseLeadActionStart({ action: "export", run: RUN })).toBeNull();
  });

  it("reads the call list a call list action creates", () => {
    const callList = {
      id: "list-1",
      name: "Retorno",
      status: "building",
      createdBy: "u1",
      assigneeIds: ["u2"],
      phone: { source: "identity" },
      selected: 40,
      itemCount: 0,
      closedCount: 0,
      openCount: 0,
      skipped: {},
      createdAt: "2026-10-08T12:00:00Z",
      updatedAt: "2026-10-08T12:00:00Z",
    };
    expect(parseLeadActionStart({ action: "call_list", callList })).toEqual({ action: "call_list", callList });
    expect(parseLeadActionStart({ action: "call_list", run: RUN })).toBeNull();
    expect(parseLeadActionStart({ action: "call_list", callList: { ...callList, status: "x" } })).toBeNull();
  });

  const SEND_QUOTE = {
    count: 40,
    parts: 1,
    splitRequired: false,
    maxPerCampaign: 150000,
    unitPriceMicros: 62500,
    costMicros: 2500000,
    balanceMicros: 9000000,
    currency: "USD",
    affordable: true,
    fits: 40,
  };

  it("reads the quote a send preview carries and refuses a broken one", () => {
    const send = { ...PREVIEW, action: "send_template", send: SEND_QUOTE };
    expect(parseLeadActionPreview(send)?.send).toEqual(SEND_QUOTE);
    expect(parseLeadActionPreview({ ...send, send: { count: 1 } })).toBeNull();
    expect(parseLeadActionPreview(PREVIEW)?.send).toBeUndefined();
  });

  it("reads the prepared send a send action answers", () => {
    const review = {
      channel: "unofficial",
      parts: [{ campaignId: "c-1", name: "Aviso", status: "STOPPED", entries: 40, eligible: 38 }],
      entries: 40,
      eligible: 38,
      skipped: { blocked: 2 },
      counted: {},
      quote: { ...SEND_QUOTE, count: 38, fits: 38, dailyCap: 200, estimatedDays: 1 },
      started: false,
    };
    expect(parseLeadActionStart({ action: "send_unofficial", send: review })?.send?.eligible).toBe(38);
    expect(parseLeadActionStart({ action: "send_template", send: review })?.action).toBe("send_template");
    expect(parseLeadActionStart({ action: "send_template", run: RUN })).toBeNull();
  });
});

describe("leadActionPreviewProgress", () => {
  const running = parseLeadActionPreview({
    ...PREVIEW,
    status: "running",
    result: { ...PREVIEW.result, matched: 120000, expectedCount: 120000, selected: 15000, eligible: 14000 },
  });

  it("counts a running preview against the leads it has to go through", () => {
    expect(leadActionPreviewProgress(running)).toEqual({ done: 15000, total: 120000 });
  });

  it("counts the first N against the quantity asked, not the whole filter", () => {
    const firstN = parseLeadActionPreview({ ...PREVIEW, status: "running", result: { ...PREVIEW.result, matched: 120000, expectedCount: 5000, selected: 6000 } });
    expect(leadActionPreviewProgress(firstN)).toEqual({ done: 5000, total: 5000 });
  });

  it("has no progress for a finished preview, an empty selection or no preview", () => {
    expect(leadActionPreviewProgress(parseLeadActionPreview(PREVIEW))).toBeNull();
    expect(leadActionPreviewProgress(null)).toBeNull();
    const empty = parseLeadActionPreview({ ...PREVIEW, status: "running", result: { ...PREVIEW.result, matched: 0, expectedCount: 0, selected: 0 } });
    expect(leadActionPreviewProgress(empty)).toBeNull();
  });
});

describe("lead action messages", () => {
  it("translates every code, failure and skip reason in four locales", () => {
    for (const [locale, messages] of LOCALES) {
      const bulk = translator(messages, "leadsPage.bulk");
      for (const key of ["dialog.previewProgress", "blockers.noDialableLine", "runResumed"]) {
        expect(bulk.has(key), `${locale}: leadsPage.bulk.${key}`).toBe(true);
      }
      for (const code of LEAD_ACTION_ERROR_CODES) {
        expect(bulk.has(`errors.${code}`), `${locale}: leadsPage.bulk.errors.${code}`).toBe(true);
      }
      for (const code of LEAD_ACTION_FAILURE_CODES) {
        expect(bulk.has(`failures.${code}`), `${locale}: leadsPage.bulk.failures.${code}`).toBe(true);
      }
      for (const reason of LEAD_ACTION_SKIP_REASONS) {
        expect(bulk.has(`skipped.${reason}`), `${locale}: leadsPage.bulk.skipped.${reason}`).toBe(true);
      }
    }
  });

  it("explains a lead action refusal by its code", () => {
    const [bulk, leads, fields, selection] = translators(ptMessages as unknown as Tree);
    expect(leadActionErrorMessage([bulk, leads, fields, selection], { code: "lead_action_selection_too_large" })).toBe(
      bulk("errors.lead_action_selection_too_large"),
    );
  });

  it("falls back to the selection and filter messages", () => {
    const list = translators(ptMessages as unknown as Tree);
    expect(leadActionErrorMessage(list, { code: "selection_scope_denied" })).toBe(list[3]("errors.selection_scope_denied"));
    expect(leadActionErrorMessage(list, { code: "area_not_found" })).toBe(list[1]("errors.area_not_found"));
  });

  it("says busy for an uncoded 503 and a default message for anything unknown", () => {
    const list = translators(ptMessages as unknown as Tree);
    expect(leadActionErrorMessage(list, { status: 503 })).toBe(list[3]("errors.busy"));
    expect(leadActionErrorMessage(list, { code: "something_new", message: "raw server text" })).toBe(list[3]("errors.default"));
  });
});

describe("isLeadSendAction", () => {
  it("names the actions that prepare a send", () => {
    expect(["send_template", "send_unofficial"].every(isLeadSendAction)).toBe(true);
    expect(["classify", "export", "call_list", ""].some(isLeadSendAction)).toBe(false);
  });
});

describe("isRecordEdit", () => {
  it("names the actions that change lead records and answer a run", () => {
    expect(["classify", "assign_owner", "block"].every(isRecordEdit)).toBe(true);
    expect(["export", "meta_audience", "unknown"].some(isRecordEdit)).toBe(false);
  });
});

describe("leadActionSkipRows", () => {
  it("lists the reasons that hold leads, known ones first in the order of the action kind", () => {
    expect(leadActionSkipRows("classify", { odd: 4, gone: 3, unchanged: 0 })).toEqual([
      { reason: "gone", count: 3 },
      { reason: "odd", count: 4 },
    ]);
    expect(leadActionSkipRows("send_unofficial", { cooldown: 1, blocked: 3, no_identity: 2 }).map((row) => row.reason)).toEqual(["no_identity", "blocked", "cooldown"]);
  });
});
