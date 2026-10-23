import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import {
  CONTACT_LIST_PAGE_SIZE,
  OPEN_CONTACT_LIST_VIEW,
  type ContactListView,
} from "@/lib/campaigns/contact-list-view";

import { CampaignContactList, MissingValueMark } from "../CampaignContactList";

interface Contact {
  number: string;
  name?: string;
  missing?: boolean;
}

const copy = ptMessages.campaignContactList;

function contacts(count: number, missingEvery = 0): Contact[] {
  return Array.from({ length: count }, (_, index) => ({
    number: `55849999${String(index).padStart(5, "0")}`,
    name: `Contato ${index}`,
    missing: missingEvery > 0 && index % missingEvery === 0,
  }));
}

function List({
  rows,
  withMissing = true,
  initialView = OPEN_CONTACT_LIST_VIEW,
  panel,
}: {
  rows: Contact[];
  withMissing?: boolean;
  initialView?: ContactListView;
  panel?: React.ReactNode;
}) {
  const [view, setView] = useState(initialView);
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CampaignContactList<Contact>
        rows={rows}
        rowKey={(row) => row.number}
        number={(row) => row.number}
        name={(row) => row.name}
        valueColumns={[
          {
            key: "plano",
            header: "plano",
            render: (row) => (row.missing ? <MissingValueMark /> : "ouro"),
          },
        ]}
        searchable={(row) => [row.number, row.name]}
        missing={
          withMissing
            ? { count: rows.filter((row) => row.missing).length, isMissing: (row) => Boolean(row.missing) }
            : undefined
        }
        view={view}
        onViewChange={setView}
        actions={<button type="button">extra</button>}
        panel={panel}
        renderRowActions={(row) => <button type="button" aria-label={`remover ${row.number}`} />}
      />
    </NextIntlClientProvider>
  );
}

function bodyRows() {
  const [, ...rows] = screen.getAllByRole("row");
  return rows;
}

describe("CampaignContactList", () => {
  it("states the total and the contacts missing values once, in the summary bar", () => {
    render(<List rows={contacts(120, 3)} />);
    expect(screen.getByText(copy.total).nextElementSibling).toHaveTextContent("120");
    expect(screen.getByText(copy.missing).nextElementSibling).toHaveTextContent("40");
    expect(screen.getAllByText(copy.missing)).toHaveLength(1);
  });

  it("shows one row per contact, a page at a time", () => {
    render(<List rows={contacts(CONTACT_LIST_PAGE_SIZE + 5)} />);
    expect(bodyRows()).toHaveLength(CONTACT_LIST_PAGE_SIZE);
    expect(within(bodyRows()[0]).getByText("5584999900000")).toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText("Contato 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: ptMessages.dashboardTable.nextPage }));

    expect(bodyRows()).toHaveLength(5);
    expect(within(bodyRows()[0]).getByText(`55849999${String(CONTACT_LIST_PAGE_SIZE).padStart(5, "0")}`)).toBeInTheDocument();
  });

  it("finds contacts by number or name and goes back to the first page", () => {
    render(<List rows={contacts(CONTACT_LIST_PAGE_SIZE * 2)} initialView={{ ...OPEN_CONTACT_LIST_VIEW, page: 1 }} />);
    fireEvent.change(screen.getByRole("searchbox", { name: copy.search }), { target: { value: "contato 7" } });

    expect(bodyRows().map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual([
      "Contato 7",
      "Contato 70",
      "Contato 71",
      "Contato 72",
      "Contato 73",
      "Contato 74",
      "Contato 75",
      "Contato 76",
      "Contato 77",
      "Contato 78",
      "Contato 79",
    ]);
    expect(screen.getByText("Exibindo 11 contatos")).toBeInTheDocument();
  });

  it("keeps only the contacts missing values and clears the filters back", () => {
    render(<List rows={contacts(9, 3)} />);
    fireEvent.click(screen.getByRole("button", { name: copy.onlyMissing }));
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole("button", { name: copy.onlyMissing })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: copy.clearFilters }));
    expect(bodyRows()).toHaveLength(9);
    expect(screen.queryByRole("button", { name: copy.clearFilters })).not.toBeInTheDocument();
  });

  it("offers no missing filter when nothing can be missing", () => {
    render(<List rows={contacts(3)} withMissing={false} />);
    expect(screen.queryByText(copy.missing)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.onlyMissing })).not.toBeInTheDocument();
  });

  it("names a missing value for assistive tech and shows the muted placeholder for an empty one", () => {
    render(<List rows={[{ number: "5584999990001", missing: true }]} />);
    expect(screen.getByRole("img", { name: copy.missingValue })).toBeInTheDocument();
    expect(within(bodyRows()[0]).getAllByRole("cell")[1]).toHaveTextContent("n/d");
  });

  it("says so when the search finds nobody", () => {
    render(<List rows={contacts(3)} />);
    fireEvent.change(screen.getByRole("searchbox", { name: copy.search }), { target: { value: "ninguém" } });
    expect(screen.getByText(copy.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.emptyFiltered)).toBeInTheDocument();
  });

  it("renders the caller's actions, panel and row actions", () => {
    render(<List rows={contacts(2)} panel={<p>painel de campos</p>} />);
    expect(screen.getByRole("button", { name: "extra" })).toBeInTheDocument();
    expect(screen.getByText("painel de campos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "remover 5584999900001" })).toBeInTheDocument();
  });
});

describe("CampaignContactList with server pages", () => {
  function ServerList({ onViewChange }: { onViewChange: (view: ContactListView) => void }) {
    const [view, setView] = useState(OPEN_CONTACT_LIST_VIEW);
    return (
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CampaignContactList<Contact>
          rows={contacts(2)}
          rowKey={(row) => row.number}
          number={(row) => row.number}
          name={(row) => row.name}
          numberHeader="E-mail"
          searchable={() => []}
          view={view}
          onViewChange={(next) => {
            setView(next);
            onViewChange(next);
          }}
          server={{ total: 1204, totalItems: 120, totalPages: 3 }}
        />
      </NextIntlClientProvider>
    );
  }

  it("shows the rows the server sent with its totals and asks it for the next page", () => {
    const changes: ContactListView[] = [];
    render(<ServerList onViewChange={(view) => changes.push(view)} />);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText(copy.total).nextElementSibling).toHaveTextContent("1.204");
    expect(screen.getByRole("columnheader", { name: "E-mail" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: copy.search }), { target: { value: "ana" } });
    expect(changes.at(-1)).toEqual({ query: "ana", onlyMissing: false, page: 0 });
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Exibindo 120 contatos")).toBeInTheDocument();
  });
});
