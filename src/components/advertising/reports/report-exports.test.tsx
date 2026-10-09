import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AdAccount, AdReportExport } from "@/lib/advertising/types";

import { ReportExports } from "./report-exports";

const account = { id: "acc-1", name: "Loja", currency: "BRL", timezone: "America/Sao_Paulo" } as AdAccount;

const entry = (id: string, adAccountId: string): AdReportExport => ({
  id,
  name: `Relatório ${id}`,
  adAccountId,
  since: "2026-09-01",
  until: "2026-09-30",
  rows: 12,
  sizeBytes: 2048,
  createdBy: "user",
  createdAt: "2026-10-01T10:00:00Z",
});

const listMock = vi.fn();
const downloadMock = vi.fn();
const deleteMock = vi.fn();
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/advertising-reports", () => ({
  listAdReportExportsAction: () => listMock(),
  downloadAdReportExportAction: (value: AdReportExport) => downloadMock(value),
  deleteAdReportExportAction: (id: string) => deleteMock(id),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const permissions = (canDelete: boolean) => ({ canCreate: true, canUpdate: true, canDelete });

function renderExports(canDelete: boolean) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ReportExports account={account} permissions={permissions(canDelete)} />
    </NextIntlClientProvider>,
  );
}

describe("ReportExports", () => {
  beforeEach(() => {
    listMock.mockReset().mockResolvedValue({ data: [entry("a", "acc-1"), entry("b", "acc-2")] });
    downloadMock.mockReset().mockResolvedValue({ data: null });
    deleteMock.mockReset().mockResolvedValue({ data: null });
    toastMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it("lists only the exports of the chosen account and downloads one again", async () => {
    renderExports(true);
    expect(await screen.findByText("Relatório a")).toBeTruthy();
    expect(screen.queryByText("Relatório b")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Baixar" }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith(entry("a", "acc-1")));
  });

  it("hides Excluir without the delete permission", async () => {
    renderExports(false);
    await screen.findByText("Relatório a");
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });

  it("shows the server message when a download fails", async () => {
    downloadMock.mockResolvedValue({ error: "arquivo expirou" });
    renderExports(true);
    await screen.findByText("Relatório a");
    fireEvent.click(screen.getByRole("button", { name: "Baixar" }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Não foi possível baixar a exportação", { description: "arquivo expirou" }),
    );
  });

  it("shows the empty state when the account has no exports", async () => {
    listMock.mockResolvedValue({ data: [entry("b", "acc-2")] });
    renderExports(true);
    expect(await screen.findByText("Nenhuma exportação")).toBeTruthy();
  });
});
