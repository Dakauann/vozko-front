import { describe, expect, it } from "vitest";

import type { CodedTranslator } from "@/lib/api/coded-error";

import { localizedLintIssues } from "./lint-copy";
import type { LintIssue } from "./types";

const copy: Record<string, string> = { "lint.NODE_CONSENT_GRANT_NEEDS_REPLY": "Registrar consentimento só vale depois da resposta." };
const t = Object.assign((key: string) => copy[key] ?? key, { has: (key: string) => key in copy }) as CodedTranslator;

describe("localizedLintIssues", () => {
  it("shows the localized message of a lint code the front knows, keeping the backend hint", () => {
    const issue: LintIssue = {
      code: "NODE_CONSENT_GRANT_NEEDS_REPLY",
      severity: "blocking",
      nodeId: "consent_1",
      message: "workflow: a consent grant must come after the lead's reply",
      hint: "Use Retirar para opt-out.",
    };
    expect(localizedLintIssues(t, [issue])).toEqual([{ ...issue, message: copy["lint.NODE_CONSENT_GRANT_NEEDS_REPLY"] }]);
  });

  it("keeps the backend message for every other code", () => {
    const issue: LintIssue = { code: "missing_required_edge", severity: "blocking", message: "Conecte a saída." };
    const [same] = localizedLintIssues(t, [issue]);
    expect(same).toBe(issue);
  });
});
