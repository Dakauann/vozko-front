import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { Department } from "@/lib/department/types";
import type { WorkspaceMember } from "@/lib/workspace/types";

import { UnassignedMembersNotice } from "./unassigned-members-notice";

const members = [
  { id: "m-ana", userId: "u-ana", role: "member", username: "Ana", email: "ana@x.com" },
  { id: "m-bruno", userId: "u-bruno", role: "member", username: "", email: "bruno@x.com" },
] as WorkspaceMember[];

const departments = [{ id: "d-vendas", name: "Vendas" }] as Department[];

function renderNotice(canAssign: boolean, onAssign = vi.fn().mockResolvedValue(undefined)) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <UnassignedMembersNotice members={members} departments={departments} canAssign={canAssign} onAssign={onAssign} />
    </NextIntlClientProvider>,
  );
  return onAssign;
}

describe("UnassignedMembersNotice", () => {
  it("says how many people have no department and lists them on click", () => {
    renderNotice(false);
    expect(screen.getByText("2 membros estão sem departamento e não veem nenhuma conversa.")).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();

    const toggle = screen.getByRole("button", { name: /Ver quem está sem departamento/ });
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("ana@x.com")).toBeTruthy();
    expect(screen.getByText("bruno@x.com")).toBeTruthy();
    expect(screen.queryByText("Adicionar a um departamento")).toBeNull();
  });

  it("offers to add each person to a department for whoever manages departments", () => {
    renderNotice(true);
    fireEvent.click(screen.getByRole("button", { name: /Ver quem está sem departamento/ }));
    expect(screen.getAllByText("Adicionar a um departamento")).toHaveLength(2);
  });
});
