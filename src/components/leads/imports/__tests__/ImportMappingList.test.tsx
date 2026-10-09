import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LeadImportJob } from "@/lib/leads/imports";

import { ImportMappingList } from "../ImportMappingList";

function translate(key: string, values?: Record<string, unknown>) {
  return values ? `${key} ${JSON.stringify(values)}` : key;
}

vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign(translate, { has: () => true }),
}));

const job: LeadImportJob = {
  id: "imp-1",
  status: "uploaded",
  fileName: "base.csv",
  sizeBytes: 10,
  totalRows: 1,
  processed: 0,
  preview: {
    headers: ["telefone", "bairro"],
    sample: [["5511999990000", "Centro"]],
    columns: [],
  },
  fields: [{ key: "number", group: "identity", allowed: true, sensitive: false, repeatable: false }],
  options: { fillEmpty: true, seedInbox: false, seedConversations: false },
  createdAt: "2026-10-08T12:00:00Z",
  expiresAt: "2026-10-15T12:00:00Z",
};

describe("ImportMappingList", () => {
  it("names every column select after its column", () => {
    render(<ImportMappingList job={job} mapping={["number", ""]} onAssign={vi.fn()} errorColumn={null} />);

    expect(screen.getByRole("combobox", { name: `mapping.choose {"column":"telefone"}` })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: `mapping.choose {"column":"bairro"}` })).toBeInTheDocument();
  });
});
