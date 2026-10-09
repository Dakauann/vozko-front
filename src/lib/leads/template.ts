import { buildCsvDocument } from "@/lib/csv/csv";
import { downloadCsv } from "@/lib/browser/download";

export const LEAD_IMPORT_TEMPLATE_COLUMNS = [
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
] as const;

const TEMPLATE_ROWS: string[][] = [
  [
    "5511987654321",
    "Ana Maria Souza",
    "Ana",
    "ana.souza@exemplo.com",
    "12/03/1984",
    "",
    "1133334444",
    "01310-100",
    "Avenida Paulista",
    "1000",
    "Apto 52",
    "Bela Vista",
    "São Paulo",
    "SP",
    "",
    "",
  ],
  [
    "+55 (11) 98765-4322",
    "Bruno Souza",
    "",
    "",
    "2009-08-21",
    "11 97777-6666",
    "",
    "01310-100",
    "Avenida Paulista",
    "1000",
    "Apto 52",
    "Bela Vista",
    "São Paulo",
    "SP",
    "5511987654321",
    "filho",
  ],
  ["11987654323", "Carla Lima", "", "", "", "", "", "", "", "", "", "Centro", "Osasco", "SP", "", ""],
];

export function buildLeadImportTemplate(): string {
  return buildCsvDocument([
    {
      header: [...LEAD_IMPORT_TEMPLATE_COLUMNS],
      rows: TEMPLATE_ROWS,
    },
  ]);
}

export const LEAD_IMPORT_TEMPLATE_FILENAME = "leads-modelo.csv";

export function downloadLeadImportTemplate(): void {
  downloadCsv(buildLeadImportTemplate(), LEAD_IMPORT_TEMPLATE_FILENAME);
}
