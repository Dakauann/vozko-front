import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Workflow } from "@/lib/workflows/types";

const permissions = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/hooks/use-settled-permission", () => ({
  useSettledPermission: (resource: string, action: string) => permissions.granted.has(`${resource}:${action}`),
}));

vi.mock("@/components/dashboard/DepartmentRowSwitcher", () => ({
  DepartmentRowSwitcher: () => <span data-testid="department-switcher" />,
}));

import { WorkflowRowActions } from "./workflow-row-actions";

const t = ptMessages.workflowsPage.actions;

function row(status: Workflow["status"]): Workflow {
  return { id: "wf-1", name: "Matrícula", status, graph: { nodes: [], edges: [] } } as unknown as Workflow;
}

function renderActions(status: Workflow["status"]) {
  const handlers = {
    onPublish: vi.fn(),
    onResume: vi.fn(),
    onPause: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
    onAssignDepartment: vi.fn(async () => ({ item: null, error: null })),
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <WorkflowRowActions row={row(status)} {...handlers} />
    </NextIntlClientProvider>,
  );
  fireEvent.pointerDown(screen.getByRole("button"), { button: 0, ctrlKey: false, pointerType: "mouse" });
  return handlers;
}

describe("WorkflowRowActions permissions", () => {
  beforeEach(() => {
    permissions.granted = new Set();
  });

  it("hides publish, pause, resume, delete and the department switch until the permissions are confirmed", () => {
    renderActions("active");
    expect(screen.queryByRole("menuitem", { name: t.pause })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: t.delete })).toBeNull();
    expect(screen.queryByTestId("department-switcher")).toBeNull();
    expect(screen.getByRole("menuitem", { name: t.export })).toBeInTheDocument();
  });

  it("offers the status action for the row once workflows:update is granted", () => {
    permissions.granted = new Set(["workflows:update"]);
    const handlers = renderActions("draft");
    fireEvent.click(screen.getByRole("menuitem", { name: t.publish }));
    expect(handlers.onPublish).toHaveBeenCalledWith("wf-1");
    expect(screen.getByTestId("department-switcher")).toBeInTheDocument();
  });

  it("offers Retomar on a paused row with workflows:update", () => {
    permissions.granted = new Set(["workflows:update"]);
    renderActions("paused");
    expect(screen.getByRole("menuitem", { name: t.resume })).toBeInTheDocument();
  });

  it("offers Excluir only with workflows:delete", () => {
    permissions.granted = new Set(["workflows:delete"]);
    renderActions("active");
    expect(screen.getByRole("menuitem", { name: t.delete })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: t.pause })).toBeNull();
  });
});
