import { describe, expect, it, vi } from "vitest";

import type { ScreenCommand } from "@/lib/aichat/screen";

import { projectCommandHandler, type ProjectCommandDeps } from "./studio-project-commands";

const command: ScreenCommand = {
  id: "cmd-1",
  name: "create_project",
  projectId: "",
  args: { kind: "image", name: "Carrossel Aurea - Capa", media: [{ mediaId: "m1", url: "https://cdn/m1.png", type: "image" }], sizes: [{ width: 1080, height: 1350 }] },
};

function deps(overrides: Partial<ProjectCommandDeps> = {}): ProjectCommandDeps {
  return {
    allowed: () => true,
    automatic: () => true,
    create: vi.fn(async () => ({ ok: true as const, path: "/dashboard/studio/image/p1", projectId: "p1" })),
    opened: vi.fn(),
    locks: undefined,
    ...overrides,
  };
}

describe("projectCommandHandler", () => {
  it("creates the project, opens its editor when screens open by themselves, and says so", async () => {
    const d = deps();
    const reply = await projectCommandHandler(d)(command);
    expect(reply).toEqual({ ok: true, data: { projectId: "p1", kind: "image", opened: true } });
    expect(d.create).toHaveBeenCalledWith(expect.objectContaining({ kind: "image", name: "Carrossel Aurea - Capa" }), "cmd-1", { open: true });
    expect(d.opened).toHaveBeenCalledTimes(1);
  });

  it("keys the creation by the chat thread and the command, so the server answers a repeat with the same project", async () => {
    const d = deps();
    await projectCommandHandler(d)({ ...command, threadId: "th-1" });
    expect(d.create).toHaveBeenCalledWith(expect.anything(), "cmd-1", { open: true, origin: { threadId: "th-1", commandId: "cmd-1" } });
  });

  it("creates the project without opening it when the person opens screens by hand, and says it was not opened", async () => {
    const d = deps({ automatic: () => false });
    const reply = await projectCommandHandler(d)(command);
    expect(reply).toEqual({ ok: true, data: { projectId: "p1", kind: "image", opened: false } });
    expect(d.create).toHaveBeenCalledWith(expect.anything(), "cmd-1", { open: false });
    expect(d.opened).not.toHaveBeenCalled();
  });

  it("refuses with the reason when the project cannot be created", async () => {
    const d = deps({ create: vi.fn(async () => ({ ok: false as const, error: "imagem ilegível" })) });
    expect(await projectCommandHandler(d)(command)).toEqual({ ok: false, error: { code: "create_failed", message: "imagem ilegível" } });
    expect(d.opened).not.toHaveBeenCalled();
  });

  it("creates nothing when the turn never lets the creation go", async () => {
    const d = deps();
    const reply = await projectCommandHandler(d)({ ...command, threadId: "th-1", claim: async () => false });
    expect(reply).toMatchObject({ ok: false, error: { code: "expired" } });
    expect(d.create).not.toHaveBeenCalled();
    await projectCommandHandler(d)({ ...command, threadId: "th-1", claim: async () => true });
    expect(d.create).toHaveBeenCalledTimes(1);
  });

  it("creates nothing for someone without access or for an unreadable order", async () => {
    const blocked = deps({ allowed: () => false });
    expect(await projectCommandHandler(blocked)(command)).toMatchObject({ ok: false, error: { code: "no_access" } });
    const unreadable = deps();
    expect(await projectCommandHandler(unreadable)({ ...command, args: { kind: "audio" } })).toMatchObject({ ok: false, error: { code: "invalid_order" } });
    expect(blocked.create).not.toHaveBeenCalled();
    expect(unreadable.create).not.toHaveBeenCalled();
  });
});
