import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { useMissingSlotText } from "../send-copy";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useMissingSlotText", () => {
  const text = () => renderHook(() => useMissingSlotText(), { wrapper }).result.current;

  it("names a lead field by its label", () => {
    expect(text()({ slot: 2, source: "lead.district" })).toBe("Sem bairro para a variável {{2}}");
  });

  it("names a custom field by the label given, or by its key without one", () => {
    expect(text()({ slot: 1, source: "lead.custom:escola" }, "Escola")).toBe("Sem Escola para a variável {{1}}");
    expect(text()({ slot: 1, source: "lead.custom:escola" })).toBe("Sem escola para a variável {{1}}");
  });

  it("names only the slot of an unknown source, or of none", () => {
    expect(text()({ slot: 3, source: "toString" })).toBe("Sem valor para a variável {{3}}");
    expect(text()({ slot: 3, source: "lead.unknown" })).toBe("Sem valor para a variável {{3}}");
    expect(text()({ slot: 3 })).toBe("Sem valor para a variável {{3}}");
  });
});
