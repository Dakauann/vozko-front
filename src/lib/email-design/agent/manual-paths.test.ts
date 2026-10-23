import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { audit, problemsOf, SRC } from "@/lib/coworker/manual-path-audit";

import { EMAIL_FIELD_PATHS, EMAIL_OPERATION_PATHS, EMAIL_TOOL_PATHS } from "./manual-paths";

const TOOLS_DIR = join(SRC, "..", "..", "vozko-back", "usecases", "copilot", "copilottools", "emaildesigntools");

function goSources(): string {
  return readdirSync(TOOLS_DIR)
    .filter((file) => file.endsWith(".go") && !file.endsWith("_test.go"))
    .map((file) => readFileSync(join(TOOLS_DIR, file), "utf8"))
    .join("\n");
}

function structFields(source: string, name: string): string[] {
  const start = source.indexOf(`type ${name} struct {`);
  const body = source.slice(start, source.indexOf("\n}", start));
  return [...body.matchAll(/json:"([a-z_]+)[,"]/g)].map((match) => match[1]);
}

describe("manual paths for Elo in the email editor", () => {
  const sources = goSources();

  it("gives every email operation a manual path a person can find", () => {
    const ops = /Op\s+string\s+`json:"op" req:"true" enum:"([a-z,]+)"/.exec(sources)?.[1].split(",") ?? [];
    expect(ops).toEqual(expect.arrayContaining(["add", "set", "move", "remove", "duplicate", "settings"]));
    expect(audit(ops, EMAIL_OPERATION_PATHS)).toEqual([]);
  });

  it("gives every field Elo can set a manual control", () => {
    const fields = structFields(sources, "emailFieldArgs");
    expect(fields).toEqual(expect.arrayContaining(["text", "media_id", "preheader", "ratio"]));
    expect(audit(fields, EMAIL_FIELD_PATHS)).toEqual([]);
  });

  it("covers every email tool Elo has on the server", () => {
    const names = [...new Set([...sources.matchAll(/Definition\("((?:email_|new_email_)[a-z_]+)"/g)].map((match) => match[1]))];
    expect(names).toEqual(expect.arrayContaining(["email_read", "email_edit", "email_look", "email_generate_image", "new_email_design"]));
    expect(names.flatMap((name) => problemsOf(name, EMAIL_TOOL_PATHS[name]))).toEqual([]);
  });
});
