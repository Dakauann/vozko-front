import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render as renderBare, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";

import { DashboardTable } from "./dashboard-table";

function InPt({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function InEn({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function render(ui: ReactElement) {
  return renderBare(ui, { wrapper: InPt });
}

function renderInEn(ui: ReactElement) {
  return renderBare(ui, { wrapper: InEn });
}

describe("DashboardTable default copy", () => {
  const columns = [{ key: "id", header: "Id", render: (row: { id: string }) => row.id }];

  it("speaks the viewer's locale in the empty state", () => {
    renderInEn(
      <DashboardTable<{ id: string }> data={[]} columns={columns} rowKey={(row) => row.id} />,
    );
    expect(screen.getByText("No records found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting the filters or adding new items.")).toBeInTheDocument();
  });

  it("speaks the viewer's locale in the pagination footer", () => {
    renderInEn(
      <DashboardTable<{ id: string }>
        data={[{ id: "a" }, { id: "b" }]}
        columns={columns}
        rowKey={(row) => row.id}
        pagination={{
          currentPage: 2,
          totalPages: 3,
          pageSize: 2,
          totalItems: 6,
          onPageChange: () => undefined,
          pageSizeOptions: [2, 10],
          onPageSizeChange: () => undefined,
        }}
      />,
    );
    const footer = screen.getByText(/Showing/);
    expect(footer).toHaveTextContent("Showing 3 → 4 of 6 items");
    expect(screen.getByText("Per page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("names the current page to assistive tech and never submits a surrounding form", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    renderInEn(
      <form onSubmit={onSubmit}>
        <DashboardTable<{ id: string }>
          data={[{ id: "a" }, { id: "b" }]}
          columns={columns}
          rowKey={(row) => row.id}
          pagination={{ currentPage: 2, totalPages: 3, pageSize: 2, totalItems: 6, onPageChange: () => undefined }}
        />
      </form>,
    );
    const current = screen.getByRole("button", { name: "2" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "1" })).not.toHaveAttribute("aria-current");
    for (const page of ["1", "2", "3"]) {
      expect(screen.getByRole("button", { name: page })).toHaveAttribute("type", "button");
    }
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("speaks the viewer's locale in the selection bar and checkboxes", () => {
    renderInEn(
      <DashboardTable<{ id: string }>
        data={[{ id: "a" }, { id: "b" }]}
        columns={columns}
        rowKey={(row) => row.id}
        selection={{ selectedKeys: new Set(["a", "b"]), onSelectionChange: vi.fn() }}
      />,
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select all rows on this page" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: "Select row" })).toHaveLength(2);
  });

  it("keeps the caller's own pagination words", () => {
    render(
      <DashboardTable<{ id: string }>
        data={[{ id: "a" }]}
        columns={columns}
        rowKey={(row) => row.id}
        pagination={{ currentPage: 1, totalPages: 1, pageSize: 20, totalItems: 1, onPageChange: () => undefined }}
        paginationText={{ showing: "Exibindo", of: "num total de", items: "leads" }}
      />,
    );
    expect(screen.getByText(/Exibindo/)).toHaveTextContent("Exibindo 1 → 1 num total de 1 leads");
  });
});

describe("DashboardTable body", () => {
  it("shows another body in place of the table, under the same header and toolbar", () => {
    render(
      <DashboardTable<{ id: string }>
        data={[]}
        columns={[{ key: "id", header: "Id", render: (row) => row.id }]}
        rowKey={(row) => row.id}
        headerLeft={<span>Cabeçalho</span>}
        toolbar={<span>Filtros</span>}
        pagination={{ currentPage: 1, totalPages: 1, pageSize: 20, totalItems: 0, onPageChange: () => undefined }}
        body={<div>Mapa</div>}
      />,
    );
    expect(screen.getByText("Cabeçalho")).toBeInTheDocument();
    expect(screen.getByText("Filtros")).toBeInTheDocument();
    expect(screen.getByText("Mapa")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum registro encontrado")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });
});

describe("DashboardTable selection across pages", () => {
  const PAGE_TWO = [{ id: "d" }, { id: "e" }];

  function renderPage(selected: Set<string>, onSelectionChange = vi.fn(), actions = vi.fn(() => <span>Ações</span>)) {
    render(
      <DashboardTable<{ id: string }>
        data={PAGE_TWO}
        columns={[{ key: "id", header: "Id", render: (row) => row.id }]}
        rowKey={(row) => row.id}
        toolbar={<span>Filtros</span>}
        selection={{
          selectedKeys: selected,
          onSelectionChange,
          actions,
          label: (count) => <span>{`${count} escolhidos`}</span>,
          selectAllLabel: "Selecionar a página",
          selectRowLabel: "Selecionar linha",
        }}
      />,
    );
    return { onSelectionChange, actions };
  }

  it("leaves the header unchecked when the picks live on another page", () => {
    renderPage(new Set(["a", "b", "c"]));
    expect(screen.getByRole("checkbox", { name: "Selecionar a página" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("3 escolhidos")).toBeInTheDocument();
  });

  it("checks the header from the current page keys only", () => {
    renderPage(new Set(["a", "d", "e"]));
    expect(screen.getByRole("checkbox", { name: "Selecionar a página" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows a mixed header when part of the current page is picked", () => {
    renderPage(new Set(["a", "d"]));
    expect(screen.getByRole("checkbox", { name: "Selecionar a página" })).toHaveAttribute("aria-checked", "mixed");
  });

  it("adds the current page to picks kept from other pages", () => {
    const { onSelectionChange } = renderPage(new Set(["a", "b"]));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar a página" }));
    expect([...onSelectionChange.mock.calls[0][0]].sort()).toEqual(["a", "b", "d", "e"]);
  });

  it("removes only the current page when it is already picked", () => {
    const { onSelectionChange } = renderPage(new Set(["a", "d", "e"]));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar a página" }));
    expect([...onSelectionChange.mock.calls[0][0]]).toEqual(["a"]);
  });

  it("toggles one row without dropping picks from other pages", () => {
    const { onSelectionChange } = renderPage(new Set(["a"]));
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Selecionar linha" })[0]);
    expect([...onSelectionChange.mock.calls[0][0]].sort()).toEqual(["a", "d"]);
  });

  it("asks the bulk actions for nothing about the rows on screen", () => {
    const { actions } = renderPage(new Set(["a"]));
    expect(screen.getByText("Ações")).toBeInTheDocument();
    expect(actions).toHaveBeenCalledWith();
  });

  it("shows the bar of a wide selection that holds no picks, and hides an idle one", () => {
    const view = (active: boolean) => (
      <DashboardTable<{ id: string }>
        data={PAGE_TWO}
        columns={[{ key: "id", header: "Id", render: (row) => row.id }]}
        rowKey={(row) => row.id}
        selection={{
          selectedKeys: new Set<string>(),
          onSelectionChange: vi.fn(),
          active,
          actions: () => <span>Ações</span>,
          label: () => <span>Todos do filtro</span>,
        }}
      />
    );
    const { rerender } = render(view(true));
    expect(screen.getByText("Todos do filtro")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();
    rerender(view(false));
    expect(screen.queryByText("Todos do filtro")).not.toBeInTheDocument();
  });

  it("puts the bulk bar under the toolbar, above the rows", () => {
    renderPage(new Set(["a"]));
    const toolbar = screen.getByText("Filtros");
    const bar = screen.getByText("1 escolhidos");
    expect(toolbar.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
