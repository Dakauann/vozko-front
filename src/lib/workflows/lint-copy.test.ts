import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";

import { configFieldLabel, localizedLintIssues, type LintTranslator } from "./lint-copy";
import type { LintIssue, NodeDefinition } from "./types";

function translatorFor(locale: string, messages: typeof ptMessages): LintTranslator {
  const intl = createTranslator({ locale, messages, namespace: "workflowsPage" });
  return Object.assign((key: string, values?: Record<string, string>) => intl(key as never, values as never), {
    has: (key: string) => intl.has(key as never),
  });
}

const t = translatorFor("pt", ptMessages);

const labels: Record<string, string> = { t1: "Primeira mensagem", send_1: "Enviar boas-vindas" };
const subjects = {
  nodeLabel: (nodeId: string) => labels[nodeId],
  fieldLabel: (nodeId: string, field: string) => (nodeId === "send_1" && field === "message" ? "Mensagem" : undefined),
};

describe("localizedLintIssues", () => {
  it("turns the backend sentence into a title naming the step by its label, plus what to do", () => {
    const issue: LintIssue = {
      code: "TRIGGER_NOT_CONNECTED",
      severity: "blocking",
      nodeId: "t1",
      message: 'workflow: at least one trigger node must be connected to the flow: "t1"',
      hint: "Conecte a saída do gatilho ao primeiro passo do fluxo.",
    };
    expect(localizedLintIssues(t, [issue], subjects)).toEqual([
      {
        ...issue,
        title: "“Primeira mensagem” não está ligado ao fluxo",
        fix: "Ligue a saída do gatilho ao primeiro passo do fluxo.",
        technical: null,
      },
    ]);
  });

  it("names the field by the label people see in the step form", () => {
    const issue: LintIssue = { code: "NODE_MISSING_REQUIRED_FIELD", severity: "blocking", nodeId: "send_1", field: "message", message: "raw" };
    expect(localizedLintIssues(t, [issue], subjects)[0].title).toBe("“Enviar boas-vindas”: falta preencher “Mensagem”");
  });

  it("falls back to the field key when the form has no label for it, since the key is the only specific there is", () => {
    const issue: LintIssue = { code: "NODE_UNKNOWN_CONFIG_KEY", severity: "advisory", nodeId: "send_1", field: "legacy_flag", message: "raw" };
    expect(localizedLintIssues(t, [issue], subjects)[0].title).toBe("“Enviar boas-vindas” tem uma configuração que não é reconhecida: “legacy_flag”");
  });

  it("speaks of a step in general instead of showing an internal id when the step is not on the canvas", () => {
    const issue: LintIssue = { code: "NODE_NO_OUTGOING", severity: "blocking", nodeId: "n_404", message: "raw" };
    expect(localizedLintIssues(t, [issue])[0].title).toBe("Um passo não tem para onde seguir");
  });

  it("speaks of a field in general when the issue names none", () => {
    const issue: LintIssue = { code: "NODE_MISSING_REQUIRED_FIELD", severity: "blocking", nodeId: "send_1", message: "raw" };
    expect(localizedLintIssues(t, [issue], subjects)[0].title).toBe("“Enviar boas-vindas”: falta preencher um campo");
  });

  describe("an unconnected required output", () => {
    const outputSubjects = {
      nodeLabel: (nodeId: string) => (nodeId === "opts" ? "Enviar Opções" : undefined),
      outputLabel: (nodeId: string, output: string) => (nodeId === "opts" && output === "no_match" ? "Sem correspondência" : undefined),
    };
    const missing = (path?: string): LintIssue => ({ code: "NODE_MISSING_REQUIRED_OUTPUT", severity: "blocking", nodeId: "opts", path, message: "raw" });

    it("names the output by the label its node shows next to the handle", () => {
      expect(localizedLintIssues(t, [missing("no_match")], outputSubjects)[0].title).toBe("“Enviar Opções”: a saída “Sem correspondência” precisa de uma conexão");
    });

    it("falls back to the output id when the node does not resolve that output, since the id is the only specific there is", () => {
      expect(localizedLintIssues(t, [missing("send_failed")], outputSubjects)[0].title).toBe("“Enviar Opções”: a saída “send_failed” precisa de uma conexão");
    });

    it("speaks of an output in general when the issue names none", () => {
      expect(localizedLintIssues(t, [missing()], outputSubjects)[0].title).toBe("“Enviar Opções”: uma saída precisa de uma conexão");
    });

    it.each([
      ["en", enMessages],
      ["es", esMessages],
      ["de", deMessages],
    ])("names the output in %s too", (locale, messages) => {
      const title = localizedLintIssues(translatorFor(locale, messages as typeof ptMessages), [missing("no_match")], outputSubjects)[0].title;
      expect(title).toContain("Enviar Opções");
      expect(title).toContain("Sem correspondência");
    });
  });

  it("keeps the technical sentence of an unknown code out of the title, behind the details", () => {
    const issue: LintIssue = { code: "GRAPH_SOMETHING_NEW", severity: "blocking", message: "workflow: something new broke" };
    const [view] = localizedLintIssues(t, [issue], subjects);
    expect(view.title).toBe("Problema no fluxo");
    expect(view.fix).toBe("Revise o passo indicado e tente de novo.");
    expect(view.technical).toBe("workflow: something new broke");
  });
});

describe("configFieldLabel", () => {
  const definition = { configSchema: [{ key: "message", label: "Mensagem", type: "textarea" }] } as unknown as NodeDefinition;

  it("reads the label of a declared field", () => {
    expect(configFieldLabel(definition, "message")).toBe("Mensagem");
  });

  it("knows nothing about undeclared fields or unknown node types", () => {
    expect(configFieldLabel(definition, "other")).toBeUndefined();
    expect(configFieldLabel(undefined, "message")).toBeUndefined();
  });
});
