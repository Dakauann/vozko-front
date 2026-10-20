import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Workflow } from "@/lib/workflows/types";

const permissions = vi.hoisted(() => ({ granted: new Set<string>() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/hooks/use-settled-permission", () => ({
  useSettledPermission: (resource: string, action: string) => permissions.granted.has(`${resource}:${action}`),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { EditorHeader } from "./editor-header";

const t = ptMessages.workflowsPage;
const SAVED_AT = Date.parse("2026-10-20T11:59:50Z");

function workflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    workspaceId: "ws-1",
    name: "Matrícula",
    description: "",
    status: "active",
    publishedVersion: 3,
    graph: { nodes: [], edges: [] },
    ...overrides,
  } as Workflow;
}

function renderHeader(props: Partial<ComponentProps<typeof EditorHeader>> = {}) {
  const noop = vi.fn();
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC" now={new Date("2026-10-20T12:00:00Z")}>
      <EditorHeader
        name="Matrícula"
        onNameChange={noop}
        description=""
        onDescriptionChange={noop}
        workflowType="messages"
        workflowTypeOptions={[{ value: "messages", label: "Mensagens" }]}
        onWorkflowTypeChange={noop}
        workflowState={workflow()}
        testOpen={false}
        onToggleTest={noop}
        runsOpen={false}
        onToggleRuns={noop}
        lintValid
        lintIssues={[]}
        linting={false}
        runtimeAlerts={[]}
        runtimeAlertsFailed={false}
        initialAlertId={null}
        nodeLabel={() => undefined}
        nodeConfig={() => undefined}
        onFocusNode={noop}
        onRuntimeFix={noop}
        alertsRequest={0}
        onConfigChange={noop}
        saveStatus={{ kind: "saved", at: SAVED_AT }}
        unsaved={false}
        onRetrySave={noop}
        onResolveConflict={noop}
        onEntryFix={noop}
        publishing={false}
        onPublish={noop}
        onPause={noop}
        onResume={noop}
        onOpenVersions={noop}
        onDelete={noop}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

function openMoreActions() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Mais ações" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
}

describe("EditorHeader permissions", () => {
  beforeEach(() => {
    permissions.granted = new Set();
  });

  it("hides the draft status, Publicar and the status actions until workflows:update is confirmed", () => {
    renderHeader();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: t.publication.publish })).toBeNull();
    openMoreActions();
    expect(screen.queryByRole("menuitem", { name: t.pause })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Excluir workflow" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: t.publication.versions })).toBeInTheDocument();
  });

  it("shows the draft status instead of Salvar, Publicar and Pausar once workflows:update is granted", () => {
    permissions.granted = new Set(["workflows:update"]);
    renderHeader();
    expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo há 10 segundos");
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    expect(screen.getByRole("button", { name: t.publication.publish })).toBeInTheDocument();
    openMoreActions();
    expect(screen.getByRole("menuitem", { name: t.pause })).toBeInTheDocument();
  });

  it("offers Retomar on a paused workflow only with workflows:update", () => {
    permissions.granted = new Set(["workflows:update"]);
    renderHeader({ workflowState: workflow({ status: "paused" }) });
    openMoreActions();
    expect(screen.getByRole("menuitem", { name: t.publication.resume })).toBeInTheDocument();
  });

  it("lets a new workflow be saved with workflows:create, but not published without workflows:update", () => {
    permissions.granted = new Set(["workflows:create"]);
    renderHeader({ workflowState: null, saveStatus: { kind: "pending" } });
    expect(screen.getByRole("status")).toHaveTextContent(t.draftSave.saving);
    expect(screen.queryByRole("button", { name: t.publication.publish })).toBeNull();
  });

  it("offers Excluir only with workflows:delete", () => {
    permissions.granted = new Set(["workflows:delete"]);
    renderHeader();
    openMoreActions();
    expect(screen.getByRole("menuitem", { name: "Excluir workflow" })).toBeInTheDocument();
  });
});

describe("EditorHeader draft and entry points", () => {
  beforeEach(() => {
    permissions.granted = new Set(["workflows:update"]);
    router.push.mockClear();
  });

  it("goes back to the list right away when everything is saved", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: t.backToList }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/workflows");
  });

  it("asks before leaving with unsaved or failed changes", () => {
    renderHeader({ unsaved: true, saveStatus: { kind: "failed", message: "sem conexão", retryable: true } });
    fireEvent.click(screen.getByRole("button", { name: t.backToList }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(t.draftSave.leaveTitle);
    fireEvent.click(screen.getByRole("button", { name: t.draftSave.leaveConfirm }));
    expect(router.push).toHaveBeenCalledWith("/dashboard/workflows");
  });

  it("lists where the workflow receives from in the header strip", () => {
    renderHeader({
      workflowState: workflow({
        entryPoints: [
          { kind: "webhook", nodeId: "wh", readiness: "blocked", reason: "paused" },
          { kind: "agent_call", readiness: "ready" },
        ],
      }),
    });
    const strip = screen.getByRole("group", { name: t.entryPoints.title });
    expect(within(strip).getByLabelText("Webhook: Não recebe: fluxo pausado")).toBeInTheDocument();
    expect(within(strip).getByLabelText("Chamado por agente IA: Recebe chamadas")).toBeInTheDocument();
  });

  it("has no strip when the workflow payload carries no entry points", () => {
    renderHeader();
    expect(screen.queryByRole("group", { name: t.entryPoints.title })).toBeNull();
  });
});
