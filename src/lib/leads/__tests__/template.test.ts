import { describe, expect, it } from "vitest";

import { parseDelimitedText } from "@/lib/csv/parse";

import { buildLeadImportTemplate, LEAD_IMPORT_TEMPLATE_COLUMNS } from "../template";

describe("lead import template", () => {
  it("names the columns the server recognises for every lead section", () => {
    expect(LEAD_IMPORT_TEMPLATE_COLUMNS).toEqual([
      "whatsapp",
      "nome",
      "apelido",
      "email",
      "data de nascimento",
      "celular",
      "telefone fixo",
      "cep",
      "logradouro",
      "número",
      "complemento",
      "bairro",
      "cidade",
      "uf",
      "familiar de",
      "parentesco",
    ]);
  });

  it("writes one example row per column, linking a relative inside the file", () => {
    const rows = parseDelimitedText(buildLeadImportTemplate().replace(/^﻿/, ""));
    const [header, ...examples] = rows;
    expect(header.cells).toEqual([...LEAD_IMPORT_TEMPLATE_COLUMNS]);
    expect(examples.length).toBeGreaterThanOrEqual(2);
    for (const row of examples) expect(row.cells).toHaveLength(LEAD_IMPORT_TEMPLATE_COLUMNS.length);

    const relativeColumn = LEAD_IMPORT_TEMPLATE_COLUMNS.indexOf("familiar de");
    const whatsappColumn = LEAD_IMPORT_TEMPLATE_COLUMNS.indexOf("whatsapp");
    const numbers = examples.map((row) => row.cells[whatsappColumn]);
    const linked = examples.map((row) => row.cells[relativeColumn]).filter(Boolean);
    expect(linked.length).toBeGreaterThan(0);
    for (const relative of linked) expect(numbers).toContain(relative);
  });
});
