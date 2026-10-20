import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { WORKFLOW_ERROR_CODES, type WorkflowErrorNamespace } from "./error-codes";

const BACKEND = resolve(__dirname, "../../../../vozko-back/delivery/http");
const BACKEND_GOLDENS: Record<WorkflowErrorNamespace, string[]> = {
  workflowsPage: [
    "handlers/testdata/workflow_error_codes.golden",
    "workflowwebhook/testdata/error_codes.golden",
    "workflowalerthttp/testdata/error_codes.golden",
    "conversation/testdata/ai_tool_call_error_codes.golden",
  ],
  workflowSecretsPage: ["workflowsecrethttp/testdata/error_codes.golden"],
};
const CATALOGS: Record<string, unknown> = { pt, en, es, de };
const NAMESPACES = Object.keys(WORKFLOW_ERROR_CODES) as WorkflowErrorNamespace[];

function errorsOf(messages: unknown, namespace: WorkflowErrorNamespace): Record<string, unknown> {
  const scope = (messages as Record<string, Record<string, unknown> | undefined>)[namespace];
  return (scope?.errors ?? {}) as Record<string, unknown>;
}

function goldenCodes(paths: string[]): string[] {
  const codes = paths.flatMap((path) =>
    readFileSync(resolve(BACKEND, path), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return [...new Set(codes)].sort();
}

const backendPresent = NAMESPACES.every((namespace) => BACKEND_GOLDENS[namespace].every((path) => existsSync(resolve(BACKEND, path))));

describe("workflow area error codes", () => {
  it.each(NAMESPACES)("lists the %s codes once and sorted", (namespace) => {
    const codes = WORKFLOW_ERROR_CODES[namespace];
    expect([...codes].sort()).toEqual([...codes]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(Object.keys(CATALOGS))("translates every code in %s", (locale) => {
    const missing = NAMESPACES.flatMap((namespace) => {
      const errors = errorsOf(CATALOGS[locale], namespace);
      return WORKFLOW_ERROR_CODES[namespace]
        .filter((code) => typeof errors[code] !== "string" || !(errors[code] as string).trim())
        .map((code) => `${namespace}.errors.${code}`);
    });
    expect(missing).toEqual([]);
  });

  it.skipIf(!backendPresent).each(NAMESPACES)("matches the %s codes the backend declares in its golden files", (namespace) => {
    expect([...WORKFLOW_ERROR_CODES[namespace]]).toEqual(goldenCodes(BACKEND_GOLDENS[namespace]));
  });
});
