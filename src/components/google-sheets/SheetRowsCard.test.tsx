import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/i18n/messages/pt.json";
import type { GoogleSheet } from "@/lib/google-sheets/types";
import { SheetRowsCard } from "./SheetRowsCard";

const list = vi.hoisted(() => vi.fn());
vi.mock("@/lib/google-sheets/client", () => ({ listSheetRows: list }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws" } }) }));
const sheet = { id: "sheet", columns: [{ key: "usuario", header: "Usuário", archived: false }, { key: "mensagem", header: "Mensagem", archived: false }] } as GoogleSheet;

function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NextIntlClientProvider locale="pt" messages={messages}><SheetRowsCard sheet={sheet} /></NextIntlClientProvider></QueryClientProvider>);
}

describe("SheetRowsCard", () => {
  it("shows written values and loads the next page", async () => {
    list.mockImplementation(async (_id, page) => ({ data: { items: [{ id: `row-${page}`, values: { usuario: "Dakauann", mensagem: page === 1 ? "Consulta amanhã" : "Segunda linha" }, status: "written", origin: "workflow" }], page, page_size: 25, total_items: 26, total_pages: 2 } }));
    mount();
    expect(await screen.findByText("Consulta amanhã")).toBeInTheDocument();
    expect(screen.getByText("Gravada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Segunda linha")).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledWith("sheet", 2, expect.any(AbortSignal)));
  });

  it("shows a failed read as an error", async () => {
    list.mockResolvedValue({ data: null, error: { code: "google_sheet_not_found" } });
    mount();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
