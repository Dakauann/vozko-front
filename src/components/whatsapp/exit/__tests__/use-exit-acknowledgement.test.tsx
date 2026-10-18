import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExitVerdict } from "@/lib/whatsapp-templates/exit";

const actions = vi.hoisted(() => ({ getTemplateExitVerdictAction: vi.fn() }));
vi.mock("@/app/actions/template-exit", () => actions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));

import { useExitAcknowledgement } from "../use-exit-acknowledgement";

const GATED: ExitVerdict = {
  state: "none",
  buttons: [],
  exitWords: [],
  templateExitRequired: false,
  campaignAcknowledgementRequired: true,
};
const OPEN: ExitVerdict = { ...GATED, state: "ok", exitWords: ["parar"], campaignAcknowledgementRequired: false };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderGate(templateId = "tpl-1", options: { required?: boolean } = {}) {
  return renderHook(({ id }) => useExitAcknowledgement(id, options), { wrapper, initialProps: { id: templateId } });
}

beforeEach(() => {
  actions.getTemplateExitVerdictAction.mockReset();
});

describe("useExitAcknowledgement", () => {
  it("blocks while the verdict is still loading", () => {
    actions.getTemplateExitVerdictAction.mockReturnValue(new Promise(() => undefined));
    const { result } = renderGate();
    expect(result.current.loading).toBe(true);
    expect(result.current.blocks).toBe(true);
    expect(result.current.fields).toEqual({});
  });

  it("blocks when the verdict could not be read, and lets the person try again", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValueOnce({ error: "down", status: 503 }).mockResolvedValueOnce({ data: OPEN });
    const { result } = renderGate();
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.blocks).toBe(true);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.verdict).toEqual(OPEN));
    expect(result.current.blocks).toBe(false);
  });

  it("asks for the acknowledgement when the server says sends with this template need it", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: GATED });
    const { result } = renderGate();
    await waitFor(() => expect(result.current.needed).toBe(true));
    expect(result.current.blocks).toBe(true);
    act(() => result.current.setAcknowledged(true));
    expect(result.current.blocks).toBe(false);
    expect(result.current.fields).toEqual({ exitRiskAcknowledged: true });
  });

  it("asks nothing when the server says the acknowledgement is not needed", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: OPEN });
    const { result } = renderGate();
    await waitFor(() => expect(result.current.verdict).toEqual(OPEN));
    expect(result.current.needed).toBe(false);
    expect(result.current.blocks).toBe(false);
    expect(result.current.fields).toEqual({});
  });

  it("treats a verdict without the server's answer as needing the acknowledgement", async () => {
    const unanswered: Partial<ExitVerdict> = { ...OPEN };
    delete unanswered.campaignAcknowledgementRequired;
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: unanswered });
    const { result } = renderGate();
    await waitFor(() => expect(result.current.verdict).not.toBeNull());
    expect(result.current.needed).toBe(true);
    expect(result.current.blocks).toBe(true);
  });

  it("never blocks when the acknowledgement is not asked for this request", () => {
    actions.getTemplateExitVerdictAction.mockReturnValue(new Promise(() => undefined));
    const { result } = renderGate("tpl-1", { required: false });
    expect(result.current.blocks).toBe(false);
  });

  it("does not block before a template is chosen", () => {
    const { result } = renderGate("");
    expect(result.current.blocks).toBe(false);
    expect(actions.getTemplateExitVerdictAction).not.toHaveBeenCalled();
  });

  it("forgets the tick when the template changes", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: GATED });
    const { result, rerender } = renderGate();
    await waitFor(() => expect(result.current.needed).toBe(true));
    act(() => result.current.setAcknowledged(true));
    rerender({ id: "tpl-2" });
    await waitFor(() => expect(result.current.needed).toBe(true));
    expect(result.current.acknowledged).toBe(false);
    expect(result.current.blocks).toBe(true);
  });
});
