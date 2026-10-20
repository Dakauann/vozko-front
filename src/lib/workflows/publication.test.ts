import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import type { LintIssue, Workflow } from "./types";
import {
  NOT_PUBLISHABLE,
  liveVersionMark,
  mergeLintIssues,
  publicationChip,
  publishFailureOf,
  publishFailureCopy,
  publishSteps,
  runDiffersFromCanvas,
  runPublishFlow,
  versionTag,
  workflowOptionLabel,
} from "./publication";

function workflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    workspaceId: "ws",
    name: "Matrícula",
    status: "active",
    type: "messages",
    graph: { nodes: [], edges: [] },
    version: 7,
    createdAt: "2026-10-19T10:00:00.000Z",
    updatedAt: "2026-10-19T10:00:00.000Z",
    publishedVersion: 3,
    publishedAt: "2026-10-19T10:00:00.000Z",
    hasUnpublishedChanges: false,
    ...overrides,
  };
}

describe("publicationChip", () => {
  it("reads a never published workflow as a draft without the unpublished marker, since the chip already says so", () => {
    expect(publicationChip(workflow({ status: "draft", publishedVersion: null, hasUnpublishedChanges: true }))).toEqual({
      status: "draft",
      version: null,
      unpublishedChanges: false,
    });
  });

  it("carries the published version of an active workflow", () => {
    expect(publicationChip(workflow())).toEqual({ status: "active", version: 3, unpublishedChanges: false });
  });

  it("keeps the published version of a paused workflow and flags a draft that differs from it", () => {
    expect(publicationChip(workflow({ status: "paused", hasUnpublishedChanges: true }))).toEqual({
      status: "paused",
      version: 3,
      unpublishedChanges: true,
    });
  });

  it("drops a version that is not a positive whole number instead of showing v0 or vNaN", () => {
    expect(publicationChip(workflow({ publishedVersion: 0 })).version).toBeNull();
    expect(publicationChip(workflow({ publishedVersion: undefined })).version).toBeNull();
    expect(publicationChip(workflow({ publishedVersion: 2.5 })).version).toBeNull();
  });

  it("treats a payload without the publication fields as having no unpublished changes it can prove", () => {
    const legacy = workflow({ publishedVersion: undefined, hasUnpublishedChanges: undefined });
    expect(publicationChip(legacy).unpublishedChanges).toBe(false);
  });
});

describe("versionTag", () => {
  it("prefixes the number with v", () => {
    expect(versionTag(12)).toBe("v12");
  });
});

describe("workflowOptionLabel", () => {
  it("adds the published version to the name so an agent picker tells versions apart", () => {
    expect(workflowOptionLabel(workflow())).toBe("Matrícula · v3");
  });

  it("keeps the bare name when the version is unknown", () => {
    expect(workflowOptionLabel(workflow({ publishedVersion: null }))).toBe("Matrícula");
  });
});

describe("liveVersionMark", () => {
  it("marks the published version as live while the workflow is active", () => {
    expect(liveVersionMark(3, workflow())).toBe("live");
  });

  it("marks the published version as paused while the workflow is paused", () => {
    expect(liveVersionMark(3, workflow({ status: "paused" }))).toBe("paused");
  });

  it("marks older versions as nothing", () => {
    expect(liveVersionMark(2, workflow())).toBeNull();
  });

  it("marks nothing for a workflow that was never published", () => {
    expect(liveVersionMark(1, workflow({ status: "draft", publishedVersion: null }))).toBeNull();
  });
});

describe("publishSteps", () => {
  it("only publishes when the draft on the server is what the editor shows", () => {
    expect(publishSteps({ saved: true, dirty: false })).toEqual(["publish"]);
  });

  it("saves first when the editor has edits the server has not seen", () => {
    expect(publishSteps({ saved: true, dirty: true })).toEqual(["save", "publish"]);
  });

  it("saves first when the workflow was never created", () => {
    expect(publishSteps({ saved: false, dirty: false })).toEqual(["save", "publish"]);
  });
});

describe("runPublishFlow", () => {
  it("publishes the stored draft without saving when nothing changed locally", async () => {
    const save = vi.fn();
    const publish = vi.fn(async (id: string) => ({ workflow: workflow({ id, publishedVersion: 4 }) }));
    const outcome = await runPublishFlow({ workflowId: "wf-1", dirty: false, save, publish });
    expect(save).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith("wf-1");
    expect(outcome).toEqual({ ok: true, workflow: workflow({ publishedVersion: 4 }), version: 4 });
  });

  it("saves local edits, then publishes the saved workflow", async () => {
    const calls: string[] = [];
    const save = vi.fn(async () => {
      calls.push("save");
      return workflow({ id: "wf-1" });
    });
    const publish = vi.fn(async (id: string) => {
      calls.push(`publish:${id}`);
      return { workflow: workflow({ publishedVersion: 5 }) };
    });
    const outcome = await runPublishFlow({ workflowId: "wf-1", dirty: true, save, publish });
    expect(calls).toEqual(["save", "publish:wf-1"]);
    expect(outcome.ok && outcome.version).toBe(5);
  });

  it("publishes a brand new workflow under the id the save returned", async () => {
    const publish = vi.fn(async (id: string) => ({ workflow: workflow({ id }) }));
    await runPublishFlow({ workflowId: null, dirty: false, save: async () => workflow({ id: "wf-new" }), publish });
    expect(publish).toHaveBeenCalledWith("wf-new");
  });

  it("stops before publishing when the save fails, so an old draft is never published by mistake", async () => {
    const publish = vi.fn();
    const outcome = await runPublishFlow({ workflowId: "wf-1", dirty: true, save: async () => null, publish });
    expect(publish).not.toHaveBeenCalled();
    expect(outcome).toEqual({ ok: false, stage: "save" });
  });

  it("returns the publish refusal with the stage it happened at", async () => {
    const failure = { message: "Campo obrigatório", status: 422, detail: "node n2: url" };
    const outcome = await runPublishFlow({
      workflowId: "wf-1",
      dirty: false,
      save: vi.fn(),
      publish: async () => ({ workflow: null, failure }),
    });
    expect(outcome).toEqual({ ok: false, stage: "publish", failure });
  });

  it("fails closed when the publish answer has no workflow", async () => {
    const outcome = await runPublishFlow({ workflowId: "wf-1", dirty: false, save: vi.fn(), publish: async () => ({ workflow: null }) });
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.stage).toBe("publish");
  });

  it("reports an unknown version when the published payload does not carry one", async () => {
    const outcome = await runPublishFlow({
      workflowId: "wf-1",
      dirty: false,
      save: vi.fn(),
      publish: async () => ({ workflow: workflow({ publishedVersion: null }) }),
    });
    expect(outcome.ok && outcome.version).toBeNull();
  });
});

describe("publishFailureOf", () => {
  it("keeps the message, code, status and the blocking detail the backend sent", () => {
    expect(
      publishFailureOf({ message: "Campo obrigatório não preenchido", status: 422, code: "x", details: { detail: "node n2: url is required" } }),
    ).toEqual({ message: "Campo obrigatório não preenchido", status: 422, code: "x", detail: "node n2: url is required" });
  });

  it("ignores a detail that is not text", () => {
    expect(publishFailureOf({ message: "Erro", details: { detail: { nested: true } } })).toEqual({ message: "Erro" });
  });
});

describe("publishFailureCopy", () => {
  const translate = Object.assign((key: string) => `t:${key}`, { has: (key: string) => key === "errors.known_code" });

  it("titles the toast with the backend message and puts the blocking detail under it", () => {
    expect(publishFailureCopy({ message: "Campo obrigatório", detail: "node n2: url" }, translate, "Falhou")).toEqual({
      title: "Campo obrigatório",
      description: "node n2: url",
    });
  });

  it("prefers the catalog copy for a known error code", () => {
    expect(publishFailureCopy({ message: "raw", code: "known_code" }, translate, "Falhou").title).toBe("t:errors.known_code");
  });

  it("falls back to the generic copy when the backend sent no message", () => {
    expect(publishFailureCopy({ message: "" }, translate, "Falhou")).toEqual({ title: "Falhou" });
  });

  it("does not repeat the detail when it is the message itself", () => {
    expect(publishFailureCopy({ message: "same", detail: "same" }, translate, "Falhou")).toEqual({ title: "same" });
  });
});

describe("publishFailureOf with blocking issues", () => {
  const issues = [
    { code: "TRIGGER_NOT_CONNECTED", severity: "blocking", nodeId: "t1", message: "trigger not connected" },
    { code: "GRAPH_NO_END", severity: "blocking", message: "no end node", path: "graph" },
  ];

  it("keeps every issue a not publishable refusal lists", () => {
    const failure = publishFailureOf({ message: "Não foi possível publicar", status: 422, code: NOT_PUBLISHABLE, details: { issues } });
    expect(failure.issues).toEqual(issues);
  });

  it("drops entries that are not issues instead of trusting the payload", () => {
    const failure = publishFailureOf({
      message: "x",
      code: NOT_PUBLISHABLE,
      details: { issues: [issues[0], { code: 3 }, null, "texto", { code: "X", severity: "blocking" }] },
    });
    expect(failure.issues).toEqual([issues[0]]);
  });

  it("carries no issues for any other refusal", () => {
    expect(publishFailureOf({ message: "Saldo insuficiente", status: 402, details: { issues } }).issues).toBeUndefined();
  });
});

describe("mergeLintIssues", () => {
  const lint: LintIssue[] = [
    { code: "GRAPH_NO_END", severity: "blocking", message: "lint no end" },
    { code: "NODE_UNKNOWN_CONFIG_KEY", severity: "advisory", nodeId: "n1", message: "chave" },
  ];

  it("adds the publish issues the live lint does not know, without duplicating the ones it does", () => {
    const publish: LintIssue[] = [
      { code: "GRAPH_NO_END", severity: "blocking", message: "publish no end" },
      { code: "NODE_INVALID_RESOURCE_REF", severity: "blocking", nodeId: "lbl", message: "etiqueta" },
    ];
    expect(mergeLintIssues(lint, publish)).toEqual([...lint, publish[1]]);
  });

  it("tells issues of the same code apart by node", () => {
    const publish: LintIssue[] = [{ code: "NODE_UNKNOWN_CONFIG_KEY", severity: "blocking", nodeId: "n2", message: "outra" }];
    expect(mergeLintIssues(lint, publish)).toHaveLength(3);
  });

  it("returns the lint list itself when publishing found nothing new", () => {
    expect(mergeLintIssues(lint, [])).toBe(lint);
  });
});

describe("publishFailureCopy for blocking issues", () => {
  const intl = createTranslator({ locale: "pt", messages: ptMessages, namespace: "workflowsPage" });
  const t = Object.assign((key: string, values?: Record<string, string | number>) => intl(key as never, values as never), {
    has: (key: string) => intl.has(key as never),
  });

  it("counts the problems and names the first one in the words of the Alertas panel, never the backend sentence", () => {
    const failure = {
      message: "Não foi possível publicar",
      code: NOT_PUBLISHABLE,
      issues: [
        { code: "TRIGGER_NOT_CONNECTED", severity: "blocking", nodeId: "t1", message: 'workflow: at least one trigger node must be connected to the flow: "t1"' },
        { code: "GRAPH_NO_END", severity: "blocking", message: "workflow: no end node" },
      ] as LintIssue[],
    };
    const subjects = { nodeLabel: (nodeId: string) => (nodeId === "t1" ? "Primeira mensagem" : undefined) };
    expect(publishFailureCopy(failure, t, "Falhou", subjects)).toEqual({
      title: "Não foi possível publicar: 2 problemas",
      description: "“Primeira mensagem” não está ligado ao fluxo",
    });
  });

  it("speaks of a step in general when the caller has no canvas to name it", () => {
    const failure = { message: "x", code: NOT_PUBLISHABLE, issues: [{ code: "NODE_NO_OUTGOING", severity: "blocking", nodeId: "n9", message: "raw" }] as LintIssue[] };
    expect(publishFailureCopy(failure, t, "Falhou").description).toBe("Um passo não tem para onde seguir");
  });
});

describe("runDiffersFromCanvas", () => {
  it("says nothing when the run used the published version and the draft is that version", () => {
    expect(runDiffersFromCanvas(3, workflow(), false)).toBe(false);
  });

  it("warns when the run used an older version", () => {
    expect(runDiffersFromCanvas(2, workflow(), false)).toBe(true);
  });

  it("warns when the draft moved on from the version the run used", () => {
    expect(runDiffersFromCanvas(3, workflow({ hasUnpublishedChanges: true }), false)).toBe(true);
  });

  it("warns when the canvas has edits that are not saved yet", () => {
    expect(runDiffersFromCanvas(3, workflow(), true)).toBe(true);
  });

  it("warns when the run has no recorded version, since the match cannot be proved", () => {
    expect(runDiffersFromCanvas(undefined, workflow(), false)).toBe(true);
  });
});
