import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

vi.mock("@/app/actions/workflows", () => ({
  getWorkflowAction: vi.fn(async () => ({ workflow: null, error: "harness" })),
  getNodeTypesAction: vi.fn(async () => ({ definitions: [] })),
  resolveHandlesAction: vi.fn(async () => ({ handles: {} })),
}));

import { WorkflowRunDrawer } from "./WorkflowRunDrawer";

function Intl({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>
  );
}

describe("WorkflowRunDrawer", () => {
  it("links to the run detail in the editor instead of duplicating the viewer", async () => {
    render(
      <WorkflowRunDrawer handler={{ kind: "workflow", workflow_id: "wf1", workflow_run_id: "run-9", run_status: "error" }} open onOpenChange={() => undefined} />,
      { wrapper: Intl },
    );

    expect(await screen.findByRole("link", { name: /Ver execução/ })).toHaveAttribute("href", "/dashboard/workflows/wf1?run=run-9");
  });

  it("offers no link when the handler carries no run", async () => {
    render(<WorkflowRunDrawer handler={{ kind: "workflow", workflow_id: "wf1" }} open onOpenChange={() => undefined} />, { wrapper: Intl });

    expect(await screen.findByText("Fluxo em atendimento")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver execução/ })).toBeNull();
  });
});
