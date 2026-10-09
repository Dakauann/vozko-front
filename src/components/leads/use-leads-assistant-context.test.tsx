import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useAssistantContext } from "@/components/ai-chat/assistant-context";
import ptMessages from "@/i18n/messages/pt.json";
import type { CrmFilter } from "@/lib/crm/board";

import { usePublishLeadsAssistantContext, type LeadsScreenState } from "./use-leads-assistant-context";

const filter: CrmFilter = { groups: [{ conjunction: "and", predicates: [{ field: "owner", operator: "eq", values: ["u-1"] }] }] };

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function usePublished(state: LeadsScreenState) {
  usePublishLeadsAssistantContext(state);
  return useAssistantContext();
}

describe("usePublishLeadsAssistantContext", () => {
  it("tells Elo what the leads screen shows, in the reader's words, and withdraws it on leave", () => {
    const { result, rerender, unmount } = renderHook((state: LeadsScreenState) => usePublished(state), {
      wrapper,
      initialProps: { filter, search: "", filterInvalid: false, filterRejected: false, selected: 0 },
    });
    expect(result.current).toEqual({
      kind: "leads",
      view: { surface: "leads", leadFilter: filter },
      scope: { filter: "Filtro com 1 condição" },
    });
    rerender({ filter, search: "", filterInvalid: false, filterRejected: false, selected: 1840 });
    expect(result.current?.view).toEqual({ surface: "leads", leadFilter: filter, selectedLeads: 1840 });
    expect(result.current?.kind === "leads" ? result.current.scope.selected : null).toBe("1.840 leads selecionados");
    rerender({ filter, search: "", filterInvalid: true, filterRejected: false, selected: 1840 });
    expect(result.current).toBeNull();
    unmount();
    const after = renderHook(() => useAssistantContext(), { wrapper });
    expect(after.result.current).toBeNull();
  });
});
