import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

import { useDealActorLabels } from "./use-deal-actor-labels";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useDealActorLabels", () => {
  it("names automated actors and removed members from one shared catalog group", () => {
    const { result } = renderHook(() => useDealActorLabels(), { wrapper });

    expect(result.current).toEqual({
      ai: ptMessages.dealActors.ai,
      workflow: ptMessages.dealActors.workflow,
      system: ptMessages.dealActors.system,
      unknownMember: ptMessages.dealActors.unknownMember,
    });
  });

  it("keeps the same labels object across renders", () => {
    const { result, rerender } = renderHook(() => useDealActorLabels(), { wrapper });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
