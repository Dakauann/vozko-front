import { describe, expect, it } from "vitest";

import type { LeadImportLimits } from "@/lib/leads/imports";

import {
  importErrorMessage,
  importGroupLabel,
  type ImportErrorContext,
  type ImportTranslator,
} from "../import-messages";

const t = Object.assign((key: string, values?: Record<string, string | number>) =>
  values ? `${key} ${JSON.stringify(values)}` : key, { has: () => true }) as ImportTranslator;

const context: ImportErrorContext = { headers: [], fields: [], formatNumber: (value) => `n${value}`, limits: null };

const limits: LeadImportLimits = {
  maxBytes: 31457280,
  maxMegabytes: 30,
  maxRows: 150000,
  maxSeededConversations: 200,
  retentionDays: 7,
  maxUnusedUploads: 5,
};

describe("importErrorMessage limits", () => {
  it("shows the file size limit the server sent with the refusal", () => {
    const message = importErrorMessage(
      t,
      { code: "lead_import_file_too_large", status: 413, expected: { maxBytes: "10485760", maxRows: "50000" } },
      context,
    );
    expect(message).toBe(`errors.lead_import_file_too_large {"megabytes":"n10"}`);
  });

  it("shows the row limit the server sent with the refusal", () => {
    const message = importErrorMessage(
      t,
      { code: "lead_import_too_many_rows", status: 413, expected: { maxBytes: "10485760", maxRows: "50000" } },
      context,
    );
    expect(message).toBe(`errors.lead_import_too_many_rows {"rows":"n50000"}`);
  });

  it("falls back to the limits the server listed when the refusal carries none", () => {
    const listed = { ...context, limits };
    expect(importErrorMessage(t, { code: "lead_import_file_too_large", status: 413 }, listed)).toBe(
      `errors.lead_import_file_too_large {"megabytes":"n30"}`,
    );
    expect(
      importErrorMessage(t, { code: "lead_import_too_many_rows", status: 413, expected: { maxRows: "lots" } }, listed),
    ).toBe(`errors.lead_import_too_many_rows {"rows":"n150000"}`);
  });

  it("never invents a limit the server did not send", () => {
    expect(importErrorMessage(t, { code: "lead_import_file_too_large", status: 413 }, context)).toBe(
      "errors.lead_import_file_too_large_unknown",
    );
    expect(importErrorMessage(t, { code: "lead_import_too_many_rows", status: 413 }, context)).toBe(
      "errors.lead_import_too_many_rows_unknown",
    );
  });
});

describe("importGroupLabel", () => {
  it("names a known group and files an unknown one under other", () => {
    const partial = Object.assign((key: string) => key, {
      has: (key: string) => key === "groups.address",
    }) as ImportTranslator;
    expect(importGroupLabel(partial, "address")).toBe("groups.address");
    expect(importGroupLabel(partial, "education")).toBe("groups.other");
  });
});
