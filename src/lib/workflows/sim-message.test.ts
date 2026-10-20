import { describe, expect, it } from "vitest";

import { readFormBlock, hasTemplateMetadata } from "@/lib/conversations/form-metadata";
import { readInteractiveMessage } from "@/lib/conversations/interactive-message";
import { bubbleSide, directionOfRow } from "@/lib/conversations/bubble-side";

import { simConversationMessage, simSenderLabel, simThreadRow } from "./sim-message";

const base = {
  id: "sim-msg-1",
  entryId: "sim-entry",
  entryType: "whatsapp",
  channel: "whatsapp",
  messageType: "ai_response",
  direction: "OUTBOUND",
  sentBy: { kind: "workflow", id: "wf-1" },
  from: "sim-business-phone",
  to: "5511999990000",
  text: "Olá",
  deliveryStatus: "sent",
  createdAt: "2026-10-20T12:00:00Z",
  updatedAt: "2026-10-20T12:00:00Z",
};

describe("simConversationMessage", () => {
  it("maps a text send to the CRM message the conversation list renders", () => {
    expect(simConversationMessage(base)).toMatchObject({
      id: "sim-msg-1",
      entry_id: "sim-entry",
      entry_type: "whatsapp",
      channel: "whatsapp",
      message_type: "ai_response",
      direction: "OUTBOUND",
      sent_by: { kind: "workflow", id: "wf-1" },
      text: "Olá",
      delivery_status: "sent",
      created_at: "2026-10-20T12:00:00Z",
    });
  });

  it("keeps the media url, type and frame with the caption as text", () => {
    const message = simConversationMessage({
      ...base,
      messageType: "media",
      mediaType: "image",
      text: "Folheto",
      media: { url: "https://cdn.test/folheto.png", mimeType: "image/png", size: 2048, layout: { width: 800, height: 600 } },
    });
    expect(message).toMatchObject({
      media_type: "image",
      media_url: "https://cdn.test/folheto.png",
      media_layout: { width: 800, height: 600 },
      text: "Folheto",
    });
  });

  it("keeps a document and an audio as media of their kind", () => {
    expect(simConversationMessage({ ...base, messageType: "media", mediaType: "document", text: "", media: { url: "https://cdn.test/contrato.pdf", filename: "contrato.pdf" } })).toMatchObject({
      media_type: "document",
      media_url: "https://cdn.test/contrato.pdf",
    });
    expect(simConversationMessage({ ...base, messageType: "audio", mediaType: "audio", text: "", media: { url: "https://cdn.test/a.ogg" } })).toMatchObject({
      message_type: "audio",
      media_type: "audio",
      media_url: "https://cdn.test/a.ogg",
    });
  });

  it("keeps reply buttons and list sections readable by the CRM interactive reader", () => {
    const buttons = simConversationMessage({ ...base, metadata: { buttons: { body_text: "Continuar?", buttons: [{ id: "sim", title: "Sim" }] } } });
    expect(readInteractiveMessage(buttons?.metadata)).toEqual({ kind: "buttons", choices: [{ kind: "button", id: "sim", title: "Sim" }] });

    const list = simConversationMessage({
      ...base,
      metadata: { list: { body_text: "Turno", button_text: "Ver", sections: [{ title: "Turnos", rows: [{ id: "m", title: "Manhã" }] }] } },
    });
    expect(readInteractiveMessage(list?.metadata)).toEqual({
      kind: "list",
      buttonText: "Ver",
      sections: [{ title: "Turnos", rows: [{ kind: "list", id: "m", title: "Manhã" }] }],
    });
  });

  it("keeps template and form metadata for the CRM template bubble and form card", () => {
    const template = simConversationMessage({
      ...base,
      messageType: "template",
      metadata: { template_name: "boas_vindas", language: "pt_BR", category: "MARKETING", body_text: "Oi Ana", components: [{ type: "BODY", text: "Oi {{1}}" }] },
    });
    expect(template?.message_type).toBe("template");
    expect(hasTemplateMetadata(template?.metadata)).toBe(true);

    const form = simConversationMessage({ ...base, metadata: { form: { kind: "message", formId: "f1", formName: "", sendId: "s1", cta: "Abrir" } } });
    expect(readFormBlock(form?.metadata)).toEqual({ kind: "message", formId: "f1", formName: "", sendId: "s1", cta: "Abrir" });
  });

  it("keeps a location with its place", () => {
    expect(simConversationMessage({ ...base, location: { latitude: -23.5, longitude: -46.6, name: "Campus", address: "Rua A, 1", candidate: false } })?.location).toEqual({
      latitude: -23.5,
      longitude: -46.6,
      name: "Campus",
      address: "Rua A, 1",
      candidate: false,
    });
  });

  it("maps the contact's reply as an inbound message", () => {
    expect(simConversationMessage({ ...base, direction: "INBOUND", messageType: "user_message", sentBy: { kind: "contact", id: "c" }, text: "Sim" })).toMatchObject({
      direction: "INBOUND",
      message_type: "user_message",
      text: "Sim",
    });
  });

  it("refuses anything that is not a message with an id", () => {
    expect(simConversationMessage(undefined)).toBeUndefined();
    expect(simConversationMessage("Olá")).toBeUndefined();
    expect(simConversationMessage([base])).toBeUndefined();
    expect(simConversationMessage({ ...base, id: "" })).toBeUndefined();
  });
});

describe("simThreadRow", () => {
  it("builds a standalone message row whose side follows the CRM direction rule", () => {
    const outbound = simConversationMessage(base)!;
    const inbound = simConversationMessage({ ...base, id: "in-1", direction: "INBOUND", sentBy: { kind: "contact", id: "c" } })!;
    expect(simThreadRow(outbound)).toEqual({
      kind: "message",
      key: "sim-msg-1",
      message: outbound,
      outgoing: true,
      groupPosition: "single",
      channelRunStart: false,
      runGap: false,
    });
    expect(simThreadRow(inbound).outgoing).toBe(false);
  });
});

const customer = { ...base, direction: "INBOUND", messageType: "user_message", sentBy: { kind: "contact", id: "5511999990000" }, from: "5511999990000", to: "sim-business-phone" };
const MEDIA = { url: "https://cdn.test/f.png", mimeType: "image/png" };
const LOCATION = { latitude: -23.5, longitude: -46.6, name: "Campus", address: "Rua A, 1", candidate: false };

describe("the tester's side for every kind of message", () => {
  const sideOf = (wire: Record<string, unknown>) => bubbleSide(directionOfRow(simThreadRow(simConversationMessage(wire)!)), "customer");

  const workflowSends: Array<[string, Record<string, unknown>]> = [
    ["text", base],
    ["media", { ...base, messageType: "media", mediaType: "image", media: MEDIA }],
    ["location", { ...base, location: LOCATION }],
    ["buttons", { ...base, metadata: { buttons: { body_text: "Continuar?", buttons: [{ id: "sim", title: "Sim" }] } } }],
    ["list", { ...base, metadata: { list: { body_text: "Turno", sections: [{ rows: [{ id: "m", title: "Manhã" }] }] } } }],
    ["template", { ...base, messageType: "template", metadata: { template_name: "boas_vindas", language: "pt_BR", body_text: "Oi" } }],
    ["form", { ...base, metadata: { form: { kind: "message", formId: "f1", formName: "", sendId: "s1", cta: "Abrir" } } }],
    ["audio", { ...base, messageType: "audio", mediaType: "audio", media: { url: "https://cdn.test/a.ogg" } }],
  ];

  it.each(workflowSends)("puts a workflow %s on the left, where what the customer receives arrives", (_kind, wire) => {
    expect(sideOf(wire)).toBe("left");
  });

  const customerSends: Array<[string, Record<string, unknown>]> = [
    ["text", customer],
    ["media", { ...customer, messageType: "media", mediaType: "image", media: MEDIA }],
    ["location", { ...customer, location: LOCATION }],
    ["button selection", { ...customer, metadata: { interactive_reply: { id: "sim", title: "Sim" } } }],
    ["list selection", { ...customer, metadata: { interactive_reply: { id: "m", title: "Manhã" } } }],
    ["form reply", { ...customer, metadata: { form: { kind: "response", formId: "f1", formName: "", sendId: "s1", answers: [] } } }],
    ["audio", { ...customer, messageType: "audio", mediaType: "audio", media: { url: "https://cdn.test/a.ogg" } }],
  ];

  it.each(customerSends)("puts the customer's own %s on the right, as the tester sent it", (_kind, wire) => {
    expect(sideOf(wire)).toBe("right");
  });
});

describe("simSenderLabel", () => {
  const copy = { customer: "Você (cliente)", workflow: "Fluxo", agent: "IA" };
  const label = (wire: Record<string, unknown>, nodeLabel?: string) => simSenderLabel(simConversationMessage(wire)!, nodeLabel, copy);

  it("names the tester as the customer on every message they send", () => {
    expect(label(customer)).toBe("Você (cliente)");
    expect(label(customer, "Mensagem Recebida")).toBe("Você (cliente)");
  });

  it("names a workflow send after the node that sent it", () => {
    expect(label(base, "Enviar Texto")).toBe("Enviar Texto");
  });

  it("falls back to the workflow when the send has no node", () => {
    expect(label(base)).toBe("Fluxo");
    expect(label({ ...base, sentBy: { kind: "system", id: "" } })).toBe("Fluxo");
  });

  it("names an agent message after the agent, then its node, then the AI", () => {
    const agent = { ...base, sentBy: { kind: "ai", id: "agent-1" } };
    expect(label({ ...agent, senderName: "Bia" }, "Agente IA")).toBe("Bia");
    expect(label(agent, "Agente IA")).toBe("Agente IA");
    expect(label(agent)).toBe("IA");
  });
});
