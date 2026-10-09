import { describe, expect, it } from "vitest";

import { translatedLabel } from "./translated-label";

const messages: Record<string, string> = { "sources.form": "formulário", "sources.other": "outra origem" };
const t = Object.assign((key: string) => messages[key] ?? key, { has: (key: string) => key in messages });

describe("translatedLabel", () => {
  it("translates a value the copy knows and falls back to a translated generic label otherwise", () => {
    expect(translatedLabel(t, "sources.form", "sources.other")).toBe("formulário");
    expect(translatedLabel(t, "sources.webhook_v9", "sources.other")).toBe("outra origem");
  });
});
