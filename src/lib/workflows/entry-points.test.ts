import { describe, expect, it } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";

import {
  ENTRY_BLOCK_REASONS,
  ENTRY_CHANNEL_KINDS,
  ENTRY_POINT_KINDS,
  MAX_SHOWN_CHANNELS,
  channelHref,
  entryPointCopy,
  entryPointsByNode,
  shownChannels,
} from "./entry-points";
import type { EntryChannel, EntryPoint } from "./types";

function entry(overrides: Partial<EntryPoint> = {}): EntryPoint {
  return { kind: "webhook", readiness: "ready", ...overrides };
}

function channel(overrides: Partial<EntryChannel> = {}): EntryChannel {
  return { kind: "facebook_page", id: "pg-1", name: "Loja", workflowEnabled: true, bound: true, ...overrides };
}

describe("entryPointCopy", () => {
  it("names a ready entry point by its kind and offers nothing to fix", () => {
    expect(entryPointCopy(entry({ kind: "agent_call" }))).toEqual({
      labelKey: "kinds.agent_call",
      ready: true,
      reasonKey: null,
      inlineKey: null,
      fix: null,
      fixKey: null,
    });
  });

  it("says why a blocked webhook refuses calls inline and offers Retomar for a paused flow", () => {
    expect(entryPointCopy(entry({ readiness: "blocked", reason: "paused", nodeId: "wh" }))).toEqual({
      labelKey: "kinds.webhook",
      ready: false,
      reasonKey: "reasons.paused",
      inlineKey: "inline.webhook",
      fix: { kind: "resume" },
      fixKey: "fixes.resume",
    });
  });

  it("offers Publicar when the flow was never published, inline for agent calls too", () => {
    const copy = entryPointCopy(entry({ kind: "agent_call", readiness: "blocked", reason: "not_published" }));
    expect(copy.inlineKey).toBe("inline.agent_call");
    expect(copy.fix).toEqual({ kind: "publish" });
    expect(copy.fixKey).toBe("fixes.publish");
  });

  it("shows no inline sentence on other trigger kinds", () => {
    expect(entryPointCopy(entry({ kind: "message_received", readiness: "blocked", reason: "no_channel" })).inlineKey).toBeNull();
  });

  it("opens the webhook node when the webhook is off or missing", () => {
    for (const reason of ["webhook_inactive", "no_webhook"] as const) {
      const copy = entryPointCopy(entry({ readiness: "blocked", reason, nodeId: "wh-1" }));
      expect(copy.fix).toEqual({ kind: "open_node", nodeId: "wh-1" });
      expect(copy.fixKey).toBe("fixes.openWebhook");
    }
    expect(entryPointCopy(entry({ readiness: "blocked", reason: "webhook_inactive" })).fix).toBeNull();
  });

  it("opens the form that needs attention, or the form list when none can be named", () => {
    const inactive = entry({
      kind: "form_submitted",
      readiness: "blocked",
      reason: "form_inactive",
      details: { forms: [{ id: "gone", name: "", active: false, missing: true }, { id: "f 2", name: "Matrícula", active: false }] },
    });
    expect(entryPointCopy(inactive).fix).toEqual({ kind: "link", href: "/dashboard/whatsapp-forms/f%202" });
    expect(entryPointCopy(inactive).fixKey).toBe("fixes.openForm");
    const missing = entry({ kind: "form_submitted", readiness: "blocked", reason: "no_form", details: { forms: [{ id: "gone", name: "", active: false, missing: true }] } });
    expect(entryPointCopy(missing).fix).toEqual({ kind: "link", href: "/dashboard/whatsapp-forms" });
  });

  it("opens the bound agent, or the agent list when no agent is bound", () => {
    const bound = entry({ kind: "agent_call", readiness: "blocked", reason: "no_agent_bound", details: { agents: [{ id: "ag-1", name: "Bia", active: false }] } });
    expect(entryPointCopy(bound).fix).toEqual({ kind: "link", href: "/dashboard/agents/ag-1" });
    expect(entryPointCopy(bound).fixKey).toBe("fixes.openAgent");
    const none = entry({ kind: "agent_call", readiness: "blocked", reason: "no_agent_bound" });
    expect(entryPointCopy(none).fix).toEqual({ kind: "link", href: "/dashboard/agents" });
  });

  it("opens the settings of the bound channel that has flows off", () => {
    const paused = entry({
      kind: "message_received",
      readiness: "blocked",
      reason: "channel_paused",
      details: { channels: [channel({ bound: false, id: "other" }), channel({ id: "pg 9", workflowEnabled: false })] },
    });
    expect(entryPointCopy(paused).fix).toEqual({ kind: "link", href: "/dashboard/facebook-pages/pg%209" });
    expect(entryPointCopy(paused).fixKey).toBe("fixes.openChannel");
    expect(entryPointCopy(entry({ kind: "message_received", readiness: "blocked", reason: "no_channel" })).fix).toBeNull();
  });

  it("says a lead exit cannot start a flow without a message trigger and offers to open the flow", () => {
    const blocked = entry({
      kind: "lead_exit",
      readiness: "blocked",
      reason: "needs_message_trigger",
      details: { leadExits: [{ source: "template", name: "boas_vindas", language: "pt_BR", button: "Quero falar" }] },
    });
    expect(entryPointCopy(blocked)).toEqual({
      labelKey: "kinds.lead_exit",
      ready: false,
      reasonKey: "reasons.needs_message_trigger",
      inlineKey: null,
      fix: { kind: "open_editor" },
      fixKey: "fixes.openEditor",
    });
  });

  it("fails closed: an unknown readiness is blocked and an unknown reason or kind gets generic copy", () => {
    const odd = entryPointCopy({ kind: "smoke_signal", readiness: "maybe", reason: "solar_flare" } as unknown as EntryPoint);
    expect(odd).toEqual({ labelKey: "kinds.unknown", ready: false, reasonKey: "reasons.unknown", inlineKey: null, fix: null, fixKey: null });
    expect(entryPointCopy(entry({ readiness: "blocked" })).reasonKey).toBe("reasons.unknown");
  });

  it("has copy for every kind, reason, inline sentence and fix in the four catalogs", () => {
    const keys = new Set<string>(["kinds.unknown", "reasons.unknown"]);
    for (const kind of ENTRY_POINT_KINDS) {
      for (const reason of ENTRY_BLOCK_REASONS) {
        const copy = entryPointCopy(entry({ kind, readiness: "blocked", reason, nodeId: "n" }));
        for (const key of [copy.labelKey, copy.reasonKey, copy.inlineKey, copy.fixKey]) if (key) keys.add(key);
      }
    }
    for (const kind of ENTRY_CHANNEL_KINDS) keys.add(`channelKinds.${kind}`);
    for (const messages of [ptMessages, enMessages, esMessages, deMessages]) {
      const scope = (messages.workflowsPage as unknown as Record<string, unknown>).entryPoints;
      for (const key of keys) {
        const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], scope);
        expect(typeof value, key).toBe("string");
      }
    }
  });
});

describe("channelHref", () => {
  it("opens each channel kind on its own settings page", () => {
    const hrefs = ENTRY_CHANNEL_KINDS.map((kind) => channelHref(channel({ kind, id: "c1" })));
    expect(hrefs).toEqual([
      "/dashboard/whatsapp-campaigns/c1",
      "/dashboard/unofficial-whatsapp-campaigns/c1",
      "/dashboard/unofficial-whatsapp/c1",
      "/dashboard/facebook-pages/c1",
      "/dashboard/instagram-accounts/c1",
      "/dashboard/telegram-accounts/c1",
      "/dashboard/tiktok-accounts/c1",
      "/dashboard/mercadolivre-accounts/c1",
      "/dashboard/webchat/c1",
      null,
      "/dashboard/rcs-sms/rcs-senders/c1",
      null,
    ]);
  });

  it("offers no link for an email inbox, which has no settings page", () => {
    expect(ENTRY_CHANNEL_KINDS).toContain("email_inbox");
    expect(channelHref(channel({ kind: "email_inbox", id: "snd-1" }))).toBeNull();
    const paused = entry({
      kind: "message_received",
      readiness: "blocked",
      reason: "channel_paused",
      details: { channels: [channel({ kind: "email_inbox", id: "snd-1", workflowEnabled: false })] },
    });
    expect(entryPointCopy(paused).fix).toBeNull();
    expect(entryPointCopy(paused).fixKey).toBeNull();
  });

  it("links an RCS sender to its page and an SMS route to nothing, which has no page of its own", () => {
    expect(ENTRY_CHANNEL_KINDS).toEqual(expect.arrayContaining(["rcs_sender", "sms_route"]));
    expect(channelHref(channel({ kind: "rcs_sender", id: "snd-1" }))).toBe("/dashboard/rcs-sms/rcs-senders/snd-1");
    expect(channelHref(channel({ kind: "sms_route", id: "rt-1" }))).toBeNull();
  });

  it("has no link for a channel kind it does not know", () => {
    expect(channelHref(channel({ kind: "pigeon" as EntryChannel["kind"] }))).toBeNull();
  });
});

describe("entry point lookups", () => {
  it("indexes trigger entries by node so a canvas node reads its own", () => {
    const webhook = entry({ nodeId: "wh" });
    const byNode = entryPointsByNode([webhook, entry({ kind: "lead_exit" })]);
    expect([...byNode.keys()]).toEqual(["wh"]);
    expect(byNode.get("wh")).toBe(webhook);
    expect(entryPointsByNode(undefined).size).toBe(0);
  });

  it("shows at most ten channels", () => {
    const many = Array.from({ length: 14 }, (_, index) => channel({ id: `c${index}` }));
    expect(MAX_SHOWN_CHANNELS).toBe(10);
    expect(shownChannels({ channels: many })).toHaveLength(10);
    expect(shownChannels(undefined)).toEqual([]);
  });
});
