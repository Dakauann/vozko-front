import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { useLeadOwnerName } from "../use-lead-owner-name";

const MEMBER = "6f1b2c3d-0000-4000-8000-000000000001";
const AGENT = "ai:6f1b2c3d-0000-4000-8000-000000000002";

function ownerNameWith(names: ReadonlyMap<string, string>, directoryReadable = true) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => useLeadOwnerName(names, directoryReadable), { wrapper }).result.current;
}

describe("lead owner name", () => {
  it("uses the name the server sent before the member directory", () => {
    const ownerName = ownerNameWith(new Map([[MEMBER, "Nome antigo"]]));
    expect(ownerName(MEMBER, "Marina Costa")).toBe("Marina Costa");
  });

  it("falls back to the member directory when the server sent no name", () => {
    const ownerName = ownerNameWith(new Map([[MEMBER, "Clara M."]]));
    expect(ownerName(MEMBER)).toBe("Clara M.");
    expect(ownerName(MEMBER, "  ")).toBe("Clara M.");
  });

  it("marks an automation owner as such, with the name the server sent", () => {
    const ownerName = ownerNameWith(new Map());
    expect(ownerName(AGENT, "Agente Ana")).toBe(`Agente Ana · ${ptMessages.leadsPage.owner.ai}`);
  });

  it("has no name for a lead without an owner", () => {
    expect(ownerNameWith(new Map())(undefined, "Marina Costa")).toBeNull();
  });

  it("says the member left when neither the server nor the directory knows them", () => {
    expect(ownerNameWith(new Map())(MEMBER)).toBe(ptMessages.leadsPage.owner.removed);
  });
});
