import { describe, expect, it } from "vitest";

import {
  optionStatsOf,
  readPromptChoiceStats,
  readTemplateChoiceStats,
  readWorkflowChoiceStats,
  sameNodeChoiceStats,
} from "./stats";

const prompt = {
  sends: 1742,
  clickedPrompts: 1394,
  clickRate: 8003,
  freeText: { count: 87, rate: 499 },
  options: [
    { optionId: "sim", shown: 1742, clicks: 244, ctr: 1400 },
    { optionId: "nao", shown: 1742, clicks: 1150, ctr: 6602 },
  ],
};

const workflowBody = {
  from: "2026-09-23",
  to: "2026-10-22",
  timezone: "America/Sao_Paulo",
  version: null,
  nodes: [{ nodeId: "menu", ...prompt }],
};

describe("readWorkflowChoiceStats", () => {
  it("reads the canvas body with every node by its id", () => {
    const stats = readWorkflowChoiceStats(workflowBody);
    expect(stats?.timezone).toBe("America/Sao_Paulo");
    expect(stats?.version).toBeNull();
    expect(stats?.nodes.get("menu")?.sends).toBe(1742);
    expect(stats?.nodes.get("menu")?.options[0]).toEqual({ optionId: "sim", shown: 1742, clicks: 244, ctr: 1400, tracked: null });
  });

  it("reads a version filter as a whole number", () => {
    expect(readWorkflowChoiceStats({ ...workflowBody, version: 3 })?.version).toBe(3);
  });

  it("refuses a body without nodes instead of showing an empty canvas", () => {
    expect(readWorkflowChoiceStats({ ...workflowBody, nodes: undefined })).toBeNull();
  });

  it("refuses a node listed twice, since which counts would be a guess", () => {
    expect(readWorkflowChoiceStats({ ...workflowBody, nodes: [{ nodeId: "menu", ...prompt }, { nodeId: "menu", ...prompt }] })).toBeNull();
  });

  it.each([
    ["a negative send count", { ...prompt, sends: -1 }],
    ["a fractional click count", { ...prompt, clickedPrompts: 1.5 }],
    ["a rate above 100%", { ...prompt, clickRate: 10001 }],
    ["a rate as a string", { ...prompt, clickRate: "80" }],
    ["free text without a rate", { ...prompt, freeText: { count: 3 } }],
    ["options that are not a list", { ...prompt, options: {} }],
    ["an option without an id", { ...prompt, options: [{ optionId: "", shown: 1, clicks: 0, ctr: 0 }] }],
    ["an option listed twice", { ...prompt, options: [prompt.options[0], prompt.options[0]] }],
    ["a tracked flag that is not a boolean", { ...prompt, options: [{ ...prompt.options[0], tracked: "yes" }] }],
  ])("refuses %s rather than reading it as zero", (_name, node) => {
    expect(readWorkflowChoiceStats({ ...workflowBody, nodes: [{ nodeId: "menu", ...node }] })).toBeNull();
  });

  it("refuses a period that is not a calendar day", () => {
    expect(readWorkflowChoiceStats({ ...workflowBody, from: "23/09/2026" })).toBeNull();
  });
});

describe("readPromptChoiceStats", () => {
  it("reads a lifetime campaign body without a range", () => {
    const stats = readPromptChoiceStats({ from: null, to: null, timezone: "America/Sao_Paulo", prompt });
    expect(stats?.from).toBeNull();
    expect(stats?.prompt.clickRate).toBe(8003);
  });

  it("refuses a body without its prompt", () => {
    expect(readPromptChoiceStats({ from: null, to: null, timezone: "America/Sao_Paulo" })).toBeNull();
  });
});

describe("readTemplateChoiceStats", () => {
  const options = [
    { optionId: "template_button:0", shown: 10, clicks: 2, ctr: 2000, tracked: true },
    { optionId: "template_url:1", shown: 10, clicks: 0, ctr: 0, tracked: false },
  ];

  it("keeps an untracked URL button apart from a button nobody tapped", () => {
    const stats = readTemplateChoiceStats({ from: null, to: null, timezone: "UTC", prompt: { ...prompt, options } });
    expect(stats?.prompt.options.map((option) => option.tracked)).toEqual([true, false]);
  });

  it("requires the tracked flag on every template option", () => {
    const untold = { optionId: "template_button:0", shown: 10, clicks: 2, ctr: 2000 };
    expect(readTemplateChoiceStats({ from: null, to: null, timezone: "UTC", prompt: { ...prompt, options: [untold] } })).toBeNull();
  });
});

describe("optionStatsOf", () => {
  it("finds the option drawn on the canvas by its handle id", () => {
    const stats = readWorkflowChoiceStats(workflowBody)!.nodes.get("menu")!;
    expect(optionStatsOf(stats, "nao")?.ctr).toBe(6602);
    expect(optionStatsOf(stats, "talvez")).toBeNull();
  });
});

describe("sameNodeChoiceStats", () => {
  it("tells equal counts apart from changed ones so a reload keeps unchanged nodes still", () => {
    const first = readWorkflowChoiceStats(workflowBody)!.nodes.get("menu")!;
    const again = readWorkflowChoiceStats(workflowBody)!.nodes.get("menu")!;
    const changed = readWorkflowChoiceStats({ ...workflowBody, nodes: [{ nodeId: "menu", ...prompt, sends: 1743 }] })!.nodes.get("menu")!;
    expect(sameNodeChoiceStats(first, again)).toBe(true);
    expect(sameNodeChoiceStats(first, changed)).toBe(false);
  });
});
