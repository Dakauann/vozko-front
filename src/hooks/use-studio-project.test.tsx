import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyImageDocument, type ImageDocument } from "@/lib/studio/document";
import type { StudioProject } from "@/lib/studio/project";

const getProject = vi.fn();
const saveProject = vi.fn();
vi.mock("@/app/actions/studio", () => ({
  getStudioProjectAction: (...args: unknown[]) => getProject(...args),
  saveStudioProjectAction: (...args: unknown[]) => saveProject(...args),
}));

import { AUTOSAVE_DELAY_MS, useStudioProject } from "./use-studio-project";

function project(version: number, overrides: Partial<StudioProject<ImageDocument>> = {}): StudioProject<ImageDocument> {
  return {
    id: "p-1",
    kind: "image",
    name: "Post",
    document: emptyImageDocument({ width: 1080, height: 1080 }),
    version,
    createdAt: "2026-10-06T10:00:00Z",
    updatedAt: "2026-10-06T10:00:00Z",
    ...overrides,
  };
}

let visibility: DocumentVisibilityState = "visible";

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function opened() {
  const hook = renderHook(() => useStudioProject("p-1", "image"));
  await advance(0);
  return hook;
}

const red = { ...emptyImageDocument({ width: 1080, height: 1080 }), canvas: { width: 1080, height: 1080, background: "#ff0000" } };

describe("useStudioProject", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    getProject.mockReset();
    saveProject.mockReset();
    getProject.mockResolvedValue({ data: project(3) });
    saveProject.mockImplementation(async (_id: string, version: number) => ({ status: "saved", project: project(version + 1) }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads the project and checks its document", async () => {
    const hook = await opened();
    expect(hook.result.current.load.status).toBe("ready");
    expect(hook.result.current.name).toBe("Post");
    expect(hook.result.current.saveStatus).toBe("saved");
  });

  it("fails closed on a document the backend would refuse", async () => {
    getProject.mockResolvedValue({ data: project(3, { document: { ...red, schema: "other" } as unknown as ImageDocument }) });
    const hook = await opened();
    expect(hook.result.current.load).toEqual({ status: "failed", error: null, issue: { field: "document", code: "unknown" } });
  });

  it("shows a load error and retries", async () => {
    getProject.mockResolvedValueOnce({ error: "boom", status: 500 });
    const hook = await opened();
    expect(hook.result.current.load.status).toBe("failed");
    act(() => hook.result.current.reload());
    await advance(0);
    expect(hook.result.current.load.status).toBe("ready");
  });

  it("debounces edits into one save with If-Match", async () => {
    const hook = await opened();
    act(() => hook.result.current.edit({ document: red }));
    act(() => hook.result.current.edit({ name: "Novo" }));
    expect(hook.result.current.saveStatus).toBe("unsaved");
    await advance(AUTOSAVE_DELAY_MS - 10);
    expect(saveProject).not.toHaveBeenCalled();
    await advance(20);
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(saveProject).toHaveBeenCalledWith("p-1", 3, { document: red, name: "Novo" }, { keepalive: false });
    expect(hook.result.current.saveStatus).toBe("saved");
    act(() => hook.result.current.edit({ name: "Outro" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(saveProject).toHaveBeenLastCalledWith("p-1", 4, { name: "Outro" }, { keepalive: false });
  });

  it("flushes with keepalive when the page is hidden", async () => {
    const hook = await opened();
    act(() => hook.result.current.edit({ name: "Novo" }));
    visibility = "hidden";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(saveProject).toHaveBeenCalledWith("p-1", 3, { name: "Novo" }, { keepalive: true });
  });

  it("surfaces a conflict without overwriting, then keeps my version on top of the current one", async () => {
    saveProject.mockResolvedValueOnce({ status: "conflict", current: project(7, { name: "De outra aba" }) });
    const hook = await opened();
    act(() => hook.result.current.edit({ document: red }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(hook.result.current.saveStatus).toBe("conflict");
    expect(hook.result.current.conflict?.version).toBe(7);
    act(() => hook.result.current.edit({ name: "Meu" }));
    await advance(AUTOSAVE_DELAY_MS * 2);
    expect(saveProject).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.keepMine());
    await advance(0);
    expect(saveProject).toHaveBeenLastCalledWith("p-1", 7, { document: red, name: "Meu" }, { keepalive: false });
    expect(hook.result.current.saveStatus).toBe("saved");
    expect(hook.result.current.conflict).toBeNull();
  });

  it("reloads the current version and drops local edits on request", async () => {
    saveProject.mockResolvedValueOnce({ status: "conflict", current: project(7, { name: "De outra aba" }) });
    const hook = await opened();
    act(() => hook.result.current.edit({ document: red }));
    await advance(AUTOSAVE_DELAY_MS);
    act(() => hook.result.current.reloadFromServer());
    expect(hook.result.current.generation).toBe(1);
    expect(hook.result.current.name).toBe("De outra aba");
    expect(hook.result.current.saveStatus).toBe("saved");
    act(() => hook.result.current.edit({ name: "Depois" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(saveProject).toHaveBeenLastCalledWith("p-1", 7, { name: "Depois" }, { keepalive: false });
  });

  it("keeps the edits after a failed save and retries them", async () => {
    saveProject.mockResolvedValueOnce({ status: "failed", error: { error: "offline" } });
    const hook = await opened();
    act(() => hook.result.current.edit({ name: "Novo" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(hook.result.current.saveStatus).toBe("error");
    expect(hook.result.current.saveError).toEqual({ error: "offline" });
    act(() => hook.result.current.retrySave());
    await advance(0);
    expect(saveProject).toHaveBeenLastCalledWith("p-1", 3, { name: "Novo" }, { keepalive: false });
    expect(hook.result.current.saveStatus).toBe("saved");
  });

  it("saves edits made during a save right after it", async () => {
    let resolve: (value: unknown) => void = () => {};
    saveProject.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const hook = await opened();
    act(() => hook.result.current.edit({ name: "Um" }));
    await advance(AUTOSAVE_DELAY_MS);
    act(() => hook.result.current.edit({ name: "Dois" }));
    expect(hook.result.current.saveStatus).toBe("saving");
    await act(async () => resolve({ status: "saved", project: project(4) }));
    expect(hook.result.current.saveStatus).toBe("unsaved");
    await advance(AUTOSAVE_DELAY_MS);
    expect(saveProject).toHaveBeenLastCalledWith("p-1", 4, { name: "Dois" }, { keepalive: false });
  });

  it("reports the saved version only once every edit reached the server", async () => {
    const hook = await opened();
    expect(hook.result.current.committed()).toEqual({ version: 3, settled: true });
    act(() => hook.result.current.edit({ name: "Novo" }));
    expect(hook.result.current.committed()).toEqual({ version: 3, settled: false });
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(hook.result.current.committed()).toEqual({ version: 4, settled: true });
  });

  it("is not settled after a failed flush or a conflict", async () => {
    saveProject.mockResolvedValueOnce({ status: "failed", error: { error: "offline" } });
    const hook = await opened();
    act(() => hook.result.current.edit({ name: "Novo" }));
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(hook.result.current.committed().settled).toBe(false);
    saveProject.mockResolvedValueOnce({ status: "conflict", current: project(9) });
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(hook.result.current.saveStatus).toBe("conflict");
    expect(hook.result.current.committed().settled).toBe(false);
  });

  it("flushes pending edits when the editor closes", async () => {
    const hook = await opened();
    act(() => hook.result.current.edit({ name: "Novo" }));
    hook.unmount();
    expect(saveProject).toHaveBeenCalledWith("p-1", 3, { name: "Novo" }, { keepalive: true });
  });
});
