import { describe, expect, it } from "vitest";

import { lintCounts, sortedLintIssues } from "./lint-severity";
import type { LintIssue } from "./types";

const issue = (code: string, severity: LintIssue["severity"]): LintIssue => ({ code, severity, message: code });

describe("lintCounts", () => {
  it("counts info apart, so a pinned output never reads as a warning", () => {
    expect(lintCounts([issue("a", "info"), issue("b", "advisory"), issue("c", "blocking"), issue("d", "info")])).toEqual({
      blocking: 1,
      advisory: 1,
      info: 2,
    });
  });

  it("treats an unknown severity as advisory, never as harmless", () => {
    expect(lintCounts([issue("x", "fatal" as LintIssue["severity"])])).toEqual({ blocking: 0, advisory: 1, info: 0 });
  });
});

describe("sortedLintIssues", () => {
  it("lists blocking first, then advisory, then info, keeping the order inside each", () => {
    const sorted = sortedLintIssues([issue("i1", "info"), issue("a1", "advisory"), issue("b1", "blocking"), issue("a2", "advisory")]);
    expect(sorted.map((entry) => entry.code)).toEqual(["b1", "a1", "a2", "i1"]);
  });
});
