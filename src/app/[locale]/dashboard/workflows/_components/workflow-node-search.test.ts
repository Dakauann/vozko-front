/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";

import { matchNodeIds, type SearchableNode } from "./workflow-node-search";

const nodes: SearchableNode[] = [
  {
    id: "ask_email",
    label: "Enviar E-mail",
    nodeType: "action_send_email",
    config: { smtp_host: "smtp.gmail.com", to: "cliente@empresa.com" },
  },
  {
    id: "greet",
    label: "Enviar Texto",
    nodeType: "action_send_text",
    config: { text: "Olá, tudo bem?" },
  },
  {
    id: "start",
    label: "Início",
    nodeType: "trigger_message",
    config: {},
  },
];

describe("matchNodeIds", () => {
  it("returns nothing for an empty query", () => {
    expect(matchNodeIds("", nodes)).toEqual([]);
    expect(matchNodeIds("   ", nodes)).toEqual([]);
  });

  it("matches on node id", () => {
    expect(matchNodeIds("greet", nodes)).toEqual(["greet"]);
  });

  it("matches on label, case-insensitively", () => {
    expect(matchNodeIds("enviar", nodes)).toEqual(["ask_email", "greet"]);
    expect(matchNodeIds("ENVIAR TEXTO", nodes)).toEqual(["greet"]);
  });

  it("matches on node type", () => {
    expect(matchNodeIds("send_email", nodes)).toEqual(["ask_email"]);
  });

  it("matches a value buried in the config (an email the user typed)", () => {
    expect(matchNodeIds("cliente@empresa.com", nodes)).toEqual(["ask_email"]);
    expect(matchNodeIds("smtp.gmail.com", nodes)).toEqual(["ask_email"]);
  });

  it("returns every node that matches a generic term (for highlighting), in order", () => {
    // A shared term highlights all matches; the caller dims the rest.
    expect(matchNodeIds("enviar", nodes)).toEqual(["ask_email", "greet"]);
  });

  it("does not match across two different fields", () => {
    // "email texto" would only match if fields were concatenated without a gap.
    expect(matchNodeIds("email texto", nodes)).toEqual([]);
  });

  it("narrows to a single node type when a type filter is set", () => {
    // The type filter alone returns every node of that type (empty query).
    expect(matchNodeIds("", nodes, { type: "action_send_text" })).toEqual([
      "greet",
    ]);
    // Type + text must both hold.
    expect(
      matchNodeIds("enviar", nodes, { type: "action_send_email" }),
    ).toEqual(["ask_email"]);
    expect(
      matchNodeIds("enviar", nodes, { type: "trigger_message" }),
    ).toEqual([]);
  });
});
