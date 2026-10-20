import type { ComponentProps } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

import { WorkflowAlerts } from "./workflow-alerts";
import type { LintIssue, RuntimeAlert } from "@/lib/workflows/types";

function renderAlerts(props: Partial<ComponentProps<typeof WorkflowAlerts>> & Pick<ComponentProps<typeof WorkflowAlerts>, "issues">) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <WorkflowAlerts valid linting={false} runtimeAlerts={[]} {...props} />
    </NextIntlClientProvider>,
  );
}

const blocking: LintIssue = {
  code: "NODE_MISSING_REQUIRED_OUTPUT",
  severity: "blocking",
  nodeId: "ask_name",
  message: 'workflow: node is missing a required output: "ask_name"',
  hint: "Conecte uma aresta a partir de cada saída obrigatória deste nó (o rótulo da aresta deve ser o id da saída).",
};
const blockingTitle = "Um passo: uma saída precisa de uma conexão";
const advisory: LintIssue = {
  code: "GRAPH_ORPHAN_NODE",
  severity: "advisory",
  nodeId: "send_bye",
  message: 'workflow: node is not reachable from any trigger: "send_bye"',
};
const advisoryTitle = "Um passo não é alcançado a partir do gatilho";

describe("WorkflowAlerts trigger", () => {
  it("shows a clean state with no count badge when there are no issues", () => {
    renderAlerts({ issues: [] });
    const trigger = screen.getByRole("button", {
      name: "Sem alertas de validação",
    });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).not.toMatch(/\d/);
  });

  it("shows the total count and a blocking-tone label when issues exist", () => {
    renderAlerts({ valid: false, issues: [blocking, advisory] });
    const trigger = screen.getByRole("button", {
      name: /Alertas: 1 bloqueio, 1 aviso/,
    });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("2");
  });
});

describe("WorkflowAlerts open request", () => {
  it("opens on a new request so a refused publish lands on the blocking issues", () => {
    const { rerender } = renderAlerts({ valid: false, issues: [advisory, blocking], openRequest: 0 });
    expect(screen.queryByText(blockingTitle)).toBeNull();

    rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <WorkflowAlerts valid={false} linting={false} runtimeAlerts={[]} issues={[advisory, blocking]} openRequest={1} />
      </NextIntlClientProvider>,
    );
    const rows = screen.getAllByText(/uma saída precisa de uma conexão|não é alcançado a partir do gatilho/);
    expect(rows[0]).toHaveTextContent(blockingTitle);
  });
});

describe("WorkflowAlerts dropdown", () => {
  it("lists issues and focuses a node when its row is clicked", async () => {
    const onFocusNode = vi.fn();
    renderAlerts({
      valid: false,
      issues: [blocking, advisory],
      nodeLabel: (id) => (id === "ask_name" ? "Perguntar nome" : id),
      onFocusNode,
    });

    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));

    const row = await screen.findByText("“Perguntar nome”: uma saída precisa de uma conexão");
    expect(row).toBeInTheDocument();
    expect(screen.getByText("“send_bye” não é alcançado a partir do gatilho")).toBeInTheDocument();
    expect(screen.getByText("Perguntar nome")).toBeInTheDocument();

    fireEvent.click(row);
    expect(onFocusNode).toHaveBeenCalledWith("ask_name");
  });

  it("shows the empty state when valid with no issues", async () => {
    renderAlerts({ issues: [] });
    fireEvent.click(screen.getByRole("button", { name: /Sem alertas/ }));
    expect(await screen.findByText("Nenhum alerta")).toBeInTheDocument();
    expect(
      screen.getByText("O workflow está válido e pronto para ativar."),
    ).toBeInTheDocument();
  });

  it("lists a pinned output as info after the warnings, without counting it as a warning", async () => {
    const pinned: LintIssue = { code: "NODE_PINNED_OUTPUT", severity: "info", nodeId: "n55", message: "Saída fixada (apenas testes)" };
    renderAlerts({ issues: [pinned, advisory] });
    const trigger = screen.getByRole("button", { name: /Alertas: 1 aviso, 1 informação/ });
    expect(within(trigger).getByText("1")).toBeInTheDocument();
    fireEvent.click(trigger);
    const info = await screen.findByText("Um passo está com a saída fixada para testes");
    expect(info.closest("[data-severity]")?.getAttribute("data-severity")).toBe("info");
    expect(screen.getByText(advisoryTitle).compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the clean look when the only alerts are info", () => {
    const pinned: LintIssue = { code: "NODE_PINNED_OUTPUT", severity: "info", nodeId: "n55", message: "Saída fixada (apenas testes)" };
    renderAlerts({ issues: [pinned] });
    const trigger = screen.getByRole("button", { name: /Alertas: 1 informação/ });
    expect(trigger.textContent).not.toMatch(/\d/);
  });
});

const plainHeader: LintIssue = {
  code: "NODE_SECRET_IN_PLAIN_TEXT",
  severity: "advisory",
  nodeId: "n55",
  field: "headers",
  path: "headers.Authorization",
  message: 'Segredo em texto no fluxo: o nó "n55" guarda o cabeçalho "Authorization" em texto puro, que fica salvo no grafo e visível para quem abre ou exporta o fluxo',
  hint: "Mova o valor para os segredos do workspace e use {{secret.authorization}} no lugar.",
};

const codeTemplate: LintIssue = {
  code: "NODE_CODE_READS_TEMPLATE",
  severity: "advisory",
  nodeId: "n56",
  field: "code",
  path: "code",
  message: 'Código lê template: o nó "n56" usa {{node.n55.status_code}} dentro do JavaScript, mas templates não são interpolados no código, então o script recebe o texto literal',
  hint: "Leia a saída do nó anterior com input.<campo> e a de outro nó com state.get('node.<id>.<campo>'). Aqui: state.get('node.n55.status_code').",
};

describe("WorkflowAlerts lint copy", () => {
  it("shows a human title and what to do, never the backend sentence or the builder hint", async () => {
    renderAlerts({ valid: false, issues: [blocking], nodeLabel: (id) => (id === "ask_name" ? "Perguntar nome" : undefined) });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    expect(await screen.findByText("“Perguntar nome”: uma saída precisa de uma conexão")).toBeInTheDocument();
    expect(screen.getByText("Ligue cada saída deste passo ao próximo passo ou a um Fim.")).toBeInTheDocument();
    expect(screen.queryByText(blocking.message)).toBeNull();
    expect(screen.queryByText(blocking.hint!)).toBeNull();
    expect(screen.queryByRole("button", { name: /Detalhes técnicos/ })).toBeNull();
  });

  it("names the field with the label of the step form", async () => {
    renderAlerts({
      issues: [plainHeader],
      nodeLabel: () => "Consultar CEP",
      fieldLabel: (nodeId, field) => (nodeId === "n55" && field === "headers" ? "Cabeçalhos" : undefined),
    });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    expect(await screen.findByText("“Consultar CEP” guarda uma senha ou chave em texto aberto em “Cabeçalhos”")).toBeInTheDocument();
  });

  it("names the unconnected output with the label its node shows next to the handle", async () => {
    renderAlerts({
      valid: false,
      issues: [{ ...blocking, nodeId: "opts", path: "no_match" }],
      nodeLabel: (id) => (id === "opts" ? "Enviar Opções" : undefined),
      outputLabel: (nodeId, output) => (nodeId === "opts" && output === "no_match" ? "Sem correspondência" : undefined),
    });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    expect(await screen.findByText("“Enviar Opções”: a saída “Sem correspondência” precisa de uma conexão")).toBeInTheDocument();
  });

  it("keeps an unknown code's technical sentence folded under Detalhes técnicos", async () => {
    const unknown: LintIssue = { code: "GRAPH_SOMETHING_NEW", severity: "blocking", message: "workflow: something new broke" };
    renderAlerts({ valid: false, issues: [unknown] });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    expect(await screen.findByText("Problema no fluxo")).toBeInTheDocument();
    expect(screen.queryByText(unknown.message)).toBeNull();
    const details = screen.getByRole("button", { name: /Detalhes técnicos/ });
    expect(details).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(details);
    expect(screen.getByText(unknown.message)).toBeInTheDocument();
  });
});

describe("WorkflowAlerts fix actions", () => {
  it("hands a located plain secret to the editor with the suggested name, never showing the value", async () => {
    const onMoveToSecret = vi.fn();
    renderAlerts({
      issues: [plainHeader],
      nodeConfig: () => ({ headers: { Authorization: "Bearer s3cr3t" } }),
      onMoveToSecret,
    });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    expect(screen.queryByText(/s3cr3t/)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /Mover para segredos/ }));
    const request = onMoveToSecret.mock.calls[0][0];
    expect(request.nodeId).toBe("n55");
    expect(request.inCode).toBe(false);
    expect(request.fix.suggestedName).toBe("authorization");
    expect(request.fix.replace("api_token")).toEqual({ headers: { Authorization: "{{secret.api_token}}" } });
  });

  it("offers no move when the node no longer holds the literal", async () => {
    renderAlerts({
      issues: [plainHeader],
      nodeConfig: () => ({ headers: { Authorization: "{{secret.authorization}}" } }),
      onMoveToSecret: vi.fn(),
    });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    await screen.findByText(/guarda uma senha ou chave em texto aberto/);
    expect(screen.queryByRole("button", { name: /Mover para segredos/ })).toBeNull();
  });

  it("shows the template found in the node code and the replacement from the alert on Ver sugestão", async () => {
    renderAlerts({ issues: [codeTemplate], nodeConfig: () => ({ code: "return { ok: {{node.n55.status_code}} };" }) });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Ver sugestão/ }));
    const box = screen.getByTestId("code-suggestion");
    expect(box.textContent).toContain("{{node.n55.status_code}}");
    expect(box.textContent).toContain("state.get('node.n55.status_code')");
  });
});

function runtimeAlert(overrides: Partial<RuntimeAlert>): RuntimeAlert {
  return {
    id: "a1",
    kind: "node_failing",
    severity: "high",
    fixAction: "open_run",
    status: "open",
    workflowId: "wf-1",
    nodeId: "n55",
    runId: "run-9",
    count: 3,
    firstSeen: "2026-10-19T10:00:00Z",
    lastSeen: "2026-10-19T11:00:00Z",
    ...overrides,
  };
}

describe("WorkflowAlerts runtime alerts", () => {
  const inactive = runtimeAlert({ id: "a2", kind: "workflow_called_inactive", fixAction: "publish", nodeId: undefined, runId: undefined, count: 2, lastSeen: "2026-10-19T12:00:00Z" });
  const failing = runtimeAlert({ id: "a1" });
  const resolved = runtimeAlert({ id: "a3", kind: "run_stuck", status: "resolved", resolvedAt: "2026-10-19T09:00:00Z", count: 1 });

  it("counts open runtime alerts with the lint issues in the header, leaving resolved ones out", () => {
    renderAlerts({ issues: [advisory], runtimeAlerts: [inactive, failing, resolved] });
    const trigger = screen.getByRole("button", { name: /Alertas: 2 em execução, 1 aviso/ });
    expect(trigger.textContent).toContain("3");
  });

  it("lists runtime alerts above lint, with their count and a fix per action", async () => {
    const onRuntimeFix = vi.fn();
    renderAlerts({ issues: [advisory], runtimeAlerts: [failing, inactive], onRuntimeFix, nodeLabel: (id) => (id === "n55" ? "Login" : id) });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));

    const runtime = await screen.findByTestId("runtime-alerts");
    const titles = within(runtime).getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Fluxo chamado mas inativo", "Nó falhando"]);
    expect(runtime.compareDocumentPosition(screen.getByText("“send_bye” não é alcançado a partir do gatilho")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(runtime).getByText(/3 ocorrências/)).toBeInTheDocument();
    expect(within(runtime).getByText("Login")).toBeInTheDocument();
    expect(within(runtime).getByText(/O nó Login falhou/)).toBeInTheDocument();

    fireEvent.click(within(runtime).getByRole("button", { name: "Publicar" }));
    expect(onRuntimeFix).toHaveBeenCalledWith({ kind: "publish" });
  });

  it("opens the run of a failing node through the editor", async () => {
    const onRuntimeFix = vi.fn();
    renderAlerts({ issues: [], runtimeAlerts: [failing], onRuntimeFix });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Abrir execução" }));
    expect(onRuntimeFix).toHaveBeenCalledWith({ kind: "open_run", runId: "run-9" });
  });

  it("links to the agent for a failing agent tool", async () => {
    renderAlerts({
      issues: [],
      runtimeAlerts: [runtimeAlert({ kind: "agent_tool_failing", fixAction: "open_agent", agentId: "ag1", subject: "http_request" })],
    });
    fireEvent.click(screen.getByRole("button", { name: /Alertas:/ }));
    expect(await screen.findByRole("link", { name: "Abrir agente" })).toHaveAttribute("href", "/dashboard/agents/ag1");
  });

  it("keeps resolved alerts muted under a fold, without a fix", async () => {
    renderAlerts({ issues: [], runtimeAlerts: [resolved] });
    fireEvent.click(screen.getByRole("button", { name: /Sem alertas/ }));
    const fold = await screen.findByRole("button", { name: /Resolvidos \(24 h\)/ });
    expect(screen.queryByText("Execução presa")).toBeNull();
    fireEvent.click(fold);
    const row = screen.getByText("Execução presa").closest("[data-alert-id]");
    expect(row).toHaveAttribute("data-resolved", "true");
    expect(within(row as HTMLElement).queryByRole("button", { name: "Abrir execução" })).toBeNull();
  });

  it("opens on the alert a notification pointed at", async () => {
    renderAlerts({ issues: [], runtimeAlerts: [failing, inactive], defaultOpen: true, highlightAlertId: "a1" });
    const row = (await screen.findByText("Nó falhando")).closest("[data-alert-id]");
    expect(row).toHaveAttribute("data-highlighted", "true");
  });

  it("says when the runtime alerts could not be read", async () => {
    renderAlerts({ issues: [], runtimeAlertsFailed: true });
    fireEvent.click(screen.getByRole("button", { name: /Alertas de execução indisponíveis/ }));
    expect(await screen.findByText("Não foi possível carregar os alertas de execução.")).toBeInTheDocument();
  });

  it("never shows the clean state after a failed read, since unread alerts are not proof of health", async () => {
    renderAlerts({ issues: [], runtimeAlertsFailed: true });
    expect(screen.queryByRole("button", { name: /Sem alertas/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Alertas de execução indisponíveis/ }));
    await screen.findByText("Não foi possível carregar os alertas de execução.");
    expect(screen.queryByText("Nenhum alerta")).toBeNull();
    expect(screen.queryByText("Tudo certo")).toBeNull();
  });

  it("keeps the lint count when the runtime read failed", () => {
    renderAlerts({ valid: false, issues: [blocking], runtimeAlertsFailed: true });
    expect(screen.getByRole("button", { name: /Alertas: 1 bloqueio/ })).toBeInTheDocument();
  });
});
