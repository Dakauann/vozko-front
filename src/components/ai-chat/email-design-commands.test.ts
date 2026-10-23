import { describe, expect, it, vi } from "vitest";

import type { ScreenCommand } from "@/lib/aichat/screen";

import { designOpenerHandler, type DesignOpenerDeps } from "./email-design-commands";

const designId = "8d6f2b1a-3c4e-4f5a-9b7c-1d2e3f4a5b6c";
const command: ScreenCommand = { id: "cmd-1", name: "open_design", projectId: "", args: { designId, name: "Black Friday" } };

function deps(overrides: Partial<DesignOpenerDeps> = {}): DesignOpenerDeps {
  return { allowed: () => true, automatic: () => true, open: vi.fn(), opened: vi.fn(), locks: undefined, ...overrides };
}

describe("designOpenerHandler", () => {
  it("opens the new design in the editor when screens open by themselves, and says so", async () => {
    const d = deps();
    expect(await designOpenerHandler(d)(command)).toEqual({ ok: true, data: { projectId: designId, kind: "email", opened: true } });
    expect(d.open).toHaveBeenCalledWith(`/dashboard/email/designs/${designId}`);
    expect(d.opened).toHaveBeenCalledTimes(1);
  });

  it("leaves the editor closed when the person opens screens by hand", async () => {
    const d = deps({ automatic: () => false });
    expect(await designOpenerHandler(d)(command)).toEqual({ ok: true, data: { projectId: designId, kind: "email", opened: false } });
    expect(d.open).not.toHaveBeenCalled();
  });

  it("refuses an unreadable order and a person without access to the editor", async () => {
    expect(await designOpenerHandler(deps())({ ...command, args: { designId: "../x" } })).toMatchObject({ ok: false, error: { code: "invalid_order" } });
    expect(await designOpenerHandler(deps({ allowed: () => false }))(command)).toMatchObject({ ok: false, error: { code: "no_access" } });
  });

  it("opens nothing when the turn never lets it go", async () => {
    const d = deps();
    expect(await designOpenerHandler(d)({ ...command, claim: async () => false })).toMatchObject({ ok: false, error: { code: "expired" } });
    expect(d.open).not.toHaveBeenCalled();
  });
});
