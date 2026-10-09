import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

import { PagedListFooter, pagedSectionState, type PagedListQuery } from "../PagedListFooter";

const retry = ptMessages.metricsOps.common.retry;

function query(overrides: Partial<PagedListQuery> = {}): PagedListQuery {
  return {
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isRefetchError: false,
    error: null,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderFooter(state: PagedListQuery) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <PagedListFooter query={state} pageSizes={[30]} loadMore="Carregar mais" loadingMore="Carregando..." />
    </NextIntlClientProvider>,
  );
}

describe("pagedSectionState", () => {
  it("is a section error only while nothing was loaded", () => {
    const refetch = vi.fn();
    const error = new Error("boom");

    expect(pagedSectionState({ isError: true, data: undefined, error, isFetching: false, refetch })).toEqual({ isError: true, error, isFetching: false, refetch });
    expect(pagedSectionState({ isError: true, data: { pages: [] }, error, isFetching: true, refetch })).toEqual({ isError: false, error, isFetching: true, refetch });
  });
});

describe("PagedListFooter", () => {
  it("keeps the loaded items and offers to read them again when a refresh fails", () => {
    const state = query({ isRefetchError: true, error: new Error("boom"), hasNextPage: true });

    renderFooter(state);

    const alert = screen.getByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: retry }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
    expect(state.fetchNextPage).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("asks for the failed next page again from its inline error", () => {
    const state = query({ isFetchNextPageError: true, error: new Error("boom"), hasNextPage: true });

    renderFooter(state);

    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: retry }));
    expect(state.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(state.refetch).not.toHaveBeenCalled();
  });

  it("offers the next page while the server has one", () => {
    const state = query({ hasNextPage: true });

    renderFooter(state);

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(state.fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
