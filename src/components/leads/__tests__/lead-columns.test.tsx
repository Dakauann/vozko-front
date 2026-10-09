import { describe, expect, it } from "vitest";
import { render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import { DashboardTable } from "@/components/elevated-design/table/dashboard-table";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { LeadListItem } from "@/lib/leads/types";

import { rowsNeedMemberDirectory, useLeadColumns, type LeadOptionalColumn } from "../use-lead-columns";

function row(overrides: Partial<LeadListItem>): LeadListItem {
  return {
    id: "lead-1",
    workspaceId: "ws",
    number: "5511900010142",
    name: "Maria Aparecida Souza",
    realName: "Maria Aparecida Souza",
    blocked: false,
    version: 2,
    createdAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-01T12:00:00Z",
    whatsappCampaigns: 3,
    totalCampaigns: 3,
    whatsappWindowOpen: true,
    memories: 0,
    phones: [],
    relativesCount: 0,
    referredCount: 0,
    ...overrides,
  };
}

const classification: CustomFieldDefinition = {
  id: "f-class",
  workspaceId: "ws",
  objectType: "lead",
  key: "interesse",
  label: "Interesse",
  type: "select",
  options: ["Matriculado", "Interessado"],
  optionTones: { Matriculado: "chart-2" },
  required: false,
  sensitive: true,
  role: "classification",
  position: 0,
  createdAt: "",
  updatedAt: "",
};

function Table({
  rows,
  optional = new Set(),
  withClassification = false,
}: {
  rows: LeadListItem[];
  optional?: ReadonlySet<LeadOptionalColumn>;
  withClassification?: boolean;
}) {
  const columns = useLeadColumns({
    optional,
    classification: withClassification ? classification : undefined,
    ownerName: (id, sent) => sent ?? (id === "u-1" ? "Clara Mendes" : null),
  });
  return <DashboardTable data={rows} columns={columns} rowKey={(item) => item.id} />;
}

function renderTable(props: Parameters<typeof Table>[0]) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <Table {...props} />
    </NextIntlClientProvider>,
  );
}

function headers(): string[] {
  return screen.getAllByRole("columnheader").map((cell) => cell.textContent?.trim() ?? "");
}

function rowOf(text: string): HTMLElement {
  const cell = screen.getByText(text);
  const tableRow = cell.closest("tr");
  if (!tableRow) throw new Error(`no row for ${text}`);
  return tableRow;
}

describe("lead list columns", () => {
  it("shows the plan columns in order, keeping Campanhas, Memórias and Janela out until chosen", () => {
    renderTable({ rows: [row({})] });
    expect(headers()).toEqual(["Nome", "Telefones", "Bairro", "Cidade", "Responsável", "Família", "Última atividade", "Criado em"]);
  });

  it("adds the chosen optional columns", () => {
    renderTable({ rows: [row({})], optional: new Set<LeadOptionalColumn>(["window", "campaigns"]) });
    expect(headers()).toContain("Janela");
    expect(headers()).toContain("Campanhas");
    expect(headers()).not.toContain("Memórias");
  });

  it("puts the classification column after the city, titled with the field's own label", () => {
    renderTable({ rows: [row({ customFields: { interesse: "Matriculado" } })], withClassification: true });
    expect(headers().slice(3, 5)).toEqual(["Cidade", "Interesse"]);
    const chip = screen.getByText("Matriculado").closest("span");
    expect(chip?.parentElement?.querySelector("[data-tone='chart-2']")).not.toBeNull();
  });

  it("names a lead with its real name and shows the WhatsApp identity below in mono", () => {
    renderTable({ rows: [row({})] });
    const link = screen.getByRole("link", { name: "Maria Aparecida Souza" });
    expect(link).toHaveAttribute("href", "/dashboard/leads/lead-1");
    const identity = screen.getByText("+55 (11) 90001-0142");
    expect(identity).toHaveClass("font-mono");
  });

  it("shows the number as the name when the stored name is only the number", () => {
    renderTable({ rows: [row({ name: "5511900047788", realName: "", number: "5511900047788" })] });
    expect(screen.getByRole("link", { name: "+55 (11) 90004-7788" })).toHaveClass("font-mono");
    expect(screen.getByText("sem nome cadastrado")).toBeInTheDocument();
  });

  it("says a relative has no WhatsApp", () => {
    renderTable({ rows: [row({ id: "lead-2", number: "", name: "Bruna Souza", realName: "Bruna Souza" })] });
    expect(screen.getByText("sem WhatsApp")).toBeInTheDocument();
  });

  it("renders phones, bairro, city, owner and family, and n/d where a value is missing", () => {
    renderTable({
      rows: [
        row({
          phones: [
            { id: "p1", number: "551141990000", label: "landline" },
            { id: "p2", number: "5511900023301", label: "mobile" },
          ],
          primaryAddress: { id: "a1", label: "home", primary: true, district: "Jardim Silveira", city: "Barueri", state: "SP", geoStatus: "pending" },
          owner: "u-1",
          relativesCount: 3,
        }),
        row({ id: "lead-3", name: "Pedro", realName: "Pedro", number: "5511900072230" }),
      ],
    });

    const full = rowOf("Maria Aparecida Souza");
    expect(within(full).getByLabelText("2 telefones de contato")).toHaveTextContent("+2");
    expect(within(full).getByText("Jardim Silveira")).toBeInTheDocument();
    expect(within(full).getByText("Barueri")).toBeInTheDocument();
    expect(within(full).getByText("Clara Mendes")).toBeInTheDocument();
    expect(within(full).getByLabelText("3 familiares")).toHaveTextContent("3");

    const bare = rowOf("Pedro");
    expect(within(bare).getAllByText("n/d").length).toBeGreaterThanOrEqual(5);
  });
});

function columnsOf(optional: ReadonlySet<LeadOptionalColumn> = new Set()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => useLeadColumns({ optional, ownerName: () => null }), { wrapper }).result.current;
}

describe("lead list owner and family columns", () => {
  it("asks for the member directory only when an owned row came without the owner's name", () => {
    expect(rowsNeedMemberDirectory([{ owner: "u-1", ownerName: "Clara M." }, { owner: undefined }])).toBe(false);
    expect(rowsNeedMemberDirectory([{ owner: "u-1", ownerName: "Clara M." }, { owner: "u-2" }])).toBe(true);
    expect(rowsNeedMemberDirectory([])).toBe(false);
  });

  it("names the owner with the name the server sent for the page", () => {
    renderTable({ rows: [row({ owner: "u-7", ownerName: "Marina Costa" })] });
    expect(within(rowOf("Maria Aparecida Souza")).getByText("Marina Costa")).toBeInTheDocument();
  });

  it("sorts Família by the number of relatives", () => {
    expect(columnsOf().find((column) => column.key === "family")?.sortKey).toBe("relativesCount");
  });

  it("offers Indicações as an optional column sorted by the number of referrals", () => {
    expect(columnsOf().some((column) => column.key === "referrals")).toBe(false);
    const referrals = columnsOf(new Set<LeadOptionalColumn>(["referrals"])).find((column) => column.key === "referrals");
    expect(referrals?.header).toBe("Indicações");
    expect(referrals?.sortKey).toBe("referredCount");
  });

  it("counts a lead's referrals and shows n/d when there are none", () => {
    renderTable({
      rows: [row({ referredCount: 4 }), row({ id: "lead-3", name: "Pedro", realName: "Pedro", number: "5511900072230" })],
      optional: new Set<LeadOptionalColumn>(["referrals"]),
    });
    expect(within(rowOf("Maria Aparecida Souza")).getByLabelText("4 indicações")).toHaveTextContent("4");
    expect(within(rowOf("Pedro")).queryByLabelText(/indicaç/)).toBeNull();
  });
});
