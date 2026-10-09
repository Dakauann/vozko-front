import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

const config = vi.hoisted(() => ({ getWorkspaceConfigAction: vi.fn() }));

vi.mock("@/app/actions/workspace-config", () => config);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));

import { callOutcomeLabel, useCallOutcomeLabel } from "./use-call-outcome-label";

const outcomes = [{ code: "interessado", label: "Interessada" }];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("callOutcomeLabel", () => {
  it("names an outcome by the workspace catalogue, a callback by its own label, and an unknown code by itself", () => {
    expect(callOutcomeLabel("interessado", outcomes, "Retornar depois")).toBe("Interessada");
    expect(callOutcomeLabel("_callback", outcomes, "Retornar depois")).toBe("Retornar depois");
    expect(callOutcomeLabel("sem_interesse", outcomes, "Retornar depois")).toBe("sem_interesse");
  });
});

describe("useCallOutcomeLabel", () => {
  it("names nothing until the workspace catalogue is read, then names by it", async () => {
    let resolve: (value: unknown) => void = () => {};
    config.getWorkspaceConfigAction.mockReturnValue(new Promise((done) => (resolve = done)));

    const { result } = renderHook(() => useCallOutcomeLabel(), { wrapper });

    expect(result.current("interessado")).toBeNull();
    resolve({ config: { outcomeCapture: { enabled: true, requireOnFinish: false, outcomes } } });
    await waitFor(() => expect(result.current("interessado")).toBe("Interessada"));
    expect(result.current("_callback")).toBe(ptMessages.callLists.queue.callbackDisposition);
  });
});
