import { act, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { SaveIndicator } from "../SaveIndicator";
import { useDraftAutosave, type DraftSaveResult } from "../use-draft-autosave";

interface Request {
  name: string;
  body: string;
}

interface Saved {
  id: string;
}

const DELAY = 1000;

function setup(initial: Request, store: (id: string | null, request: Request) => Promise<DraftSaveResult<Saved, { code: string }>>, recordId: string | null = null, editable = true) {
  const onSaved = vi.fn();
  const hook = renderHook(
    ({ request }) =>
      useDraftAutosave({
        recordId,
        baseline: recordId ? JSON.stringify(initial) : "",
        request,
        fingerprint: JSON.stringify(request),
        named: request.name !== "",
        editable,
        delayMs: DELAY,
        save: store,
        idOf: (saved) => saved.id,
        onSaved,
      }),
    { initialProps: { request: initial } },
  );
  return { ...hook, onSaved };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useDraftAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("creates once named and then updates the same record after the debounce", async () => {
    const store = vi.fn(async (id: string | null) => ({ data: { id: id ?? "d1" } }));
    const { result, rerender, onSaved } = setup({ name: "", body: "" }, store);
    await advance(DELAY * 2);
    expect(store).not.toHaveBeenCalled();
    expect(result.current.named).toBe(false);

    rerender({ request: { name: "Black Friday", body: "" } });
    expect(result.current.dirty).toBe(true);
    await advance(DELAY - 10);
    expect(store).not.toHaveBeenCalled();
    await advance(20);
    expect(store).toHaveBeenCalledWith(null, { name: "Black Friday", body: "" });
    expect(onSaved).toHaveBeenCalledWith({ id: "d1" }, true);
    expect(result.current.dirty).toBe(false);
    expect(result.current.state.phase).toBe("saved");

    rerender({ request: { name: "Black Friday", body: "Oi" } });
    await advance(DELAY);
    expect(store).toHaveBeenLastCalledWith("d1", { name: "Black Friday", body: "Oi" });
    expect(onSaved).toHaveBeenLastCalledWith({ id: "d1" }, false);
  });

  it("keeps the error and stays dirty when the save fails", async () => {
    const store = vi.fn(async () => ({ error: { code: "campaign_draft_too_large" } }));
    const { result, rerender } = setup({ name: "", body: "" }, store);
    rerender({ request: { name: "Grande", body: "x" } });
    await advance(DELAY);
    expect(result.current.state).toEqual({ phase: "error", error: { code: "campaign_draft_too_large" } });
    expect(result.current.dirty).toBe(true);
  });

  it("saves on demand and answers true when nothing changed on an existing record", async () => {
    const store = vi.fn(async (id: string | null) => ({ data: { id: id ?? "d1" } }));
    const { result } = setup({ name: "Pronta", body: "" }, store, "d9");
    let ok = false;
    await act(async () => {
      ok = await result.current.save();
    });
    expect(ok).toBe(true);
    expect(store).not.toHaveBeenCalled();
  });

  it("never saves a read only draft", async () => {
    const store = vi.fn(async () => ({ data: { id: "d1" } }));
    const { result, rerender } = setup({ name: "", body: "" }, store, null, false);
    rerender({ request: { name: "Nova", body: "" } });
    await advance(DELAY * 2);
    expect(store).not.toHaveBeenCalled();
    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });
    expect(ok).toBe(false);
  });
});

describe("SaveIndicator", () => {
  function show(node: ReactNode) {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        {node}
      </NextIntlClientProvider>,
    );
  }

  it("reads each save state", () => {
    show(<SaveIndicator state={{ phase: "idle" }} dirty={false} named={false} editable errorMessage={() => ""} />);
    expect(screen.getByText("Dê um nome para salvar o rascunho")).toBeInTheDocument();
  });

  it("shows the coded reason of a failed save", () => {
    show(<SaveIndicator state={{ phase: "error", error: { code: "x" } }} dirty named editable errorMessage={() => "grande demais"} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não salvo: grande demais");
  });

  it("says read only when the person cannot edit", () => {
    show(<SaveIndicator state={{ phase: "idle" }} dirty={false} named editable={false} errorMessage={() => ""} />);
    expect(screen.getByText("Somente leitura")).toBeInTheDocument();
  });

  it("says the draft is saved when nothing is pending", () => {
    show(<SaveIndicator state={{ phase: "idle" }} dirty={false} named editable errorMessage={() => ""} />);
    expect(screen.getByText("Rascunho salvo")).toBeInTheDocument();
  });
});
