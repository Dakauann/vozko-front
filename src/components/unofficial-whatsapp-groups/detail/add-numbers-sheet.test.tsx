import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";
import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";

import { AddNumbersSheet } from "./add-numbers-sheet";

const addGroupNumbersAction = vi.fn();
const listInstancesAction = vi.fn();

vi.mock("@/app/actions/unofficial-whatsapp-groups", () => ({
  addGroupNumbersAction: (...args: unknown[]) => addGroupNumbersAction(...args),
}));

vi.mock("@/app/actions/unofficial-whatsapp", () => ({
  listInstancesAction: (...args: unknown[]) => listInstancesAction(...args),
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const copy = ptMessages.unofficialGroups.detail.settings.addNumbers;
const joinCopy = ptMessages.unofficialGroups.join;

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo" now={new Date("2026-10-18T15:00:00Z")}>
      {children}
    </NextIntlClientProvider>
  );
}

function number(id: string, displayName: string, sessionLive: boolean): UnofficialWhatsAppInstance {
  return { id, displayName, profileName: "", phoneNumber: "", sessionLive } as unknown as UnofficialWhatsAppInstance;
}

function detail(): GroupDetail {
  return {
    group: { id: "g-1", subject: "Feira de Trocas" },
    numbers: [{ instanceId: "n1", label: "Comercial", connected: true, admin: true, canPost: true }],
  } as unknown as GroupDetail;
}

function renderSheet(onAdded = vi.fn()) {
  render(<AddNumbersSheet open onOpenChange={() => {}} detail={detail()} onAdded={onAdded} />, { wrapper: Providers });
  return onAdded;
}

beforeEach(() => {
  addGroupNumbersAction.mockReset();
  listInstancesAction.mockReset();
  listInstancesAction.mockResolvedValue({
    instances: [number("n1", "Comercial", true), number("n2", "Suporte", true), number("n3", "Pessoal", false)],
    meta: { totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
});

describe("AddNumbersSheet", () => {
  it("locks the numbers already in the group or offline and adds the chosen ones through the join queue", async () => {
    addGroupNumbersAction.mockResolvedValue({ data: { planId: "p-1", tasks: [{ status: "done" }] } });
    const onAdded = renderSheet();

    const inside = await screen.findByRole("checkbox", { name: /Comercial/ });
    expect(inside.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(joinCopy.alreadyIn)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Pessoal/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("checkbox", { name: /Suporte/ }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: copy.submit }));

    await waitFor(() => expect(addGroupNumbersAction).toHaveBeenCalledWith("g-1", ["n2"]));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
  });

  it("explains a group with no invite link to join through", async () => {
    addGroupNumbersAction.mockResolvedValue({
      error: "none of your numbers is admin in this group and no earlier join left an invite link; join it with a link",
    });
    const onAdded = renderSheet();

    await screen.findByRole("checkbox", { name: /Suporte/ });
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));

    expect(await screen.findByText(ptMessages.unofficialGroups.list.errors.noInviteLink)).toBeTruthy();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
