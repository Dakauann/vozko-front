import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGoSignals,
  createScreenAnswerer,
  createScreenClaimer,
  createScreenRegistry,
  EDITOR_GRACE_MS,
  EXPIRED_REPLY,
  isScreenCommand,
  isScreenGo,
  mayApply,
  MAX_SCREEN_MESSAGE,
  oncePerTabs,
  routeScreenCommand,
  screenOk,
  screenRefusal,
  type ReplyDelivery,
  type ScreenCommand,
  type ScreenReply,
  type TabLocks,
} from "./screen";

const read: ScreenCommand = { id: "cmd-1", name: "read", projectId: "p-1", args: { detail: "summary" } };

describe("screen registry", () => {
  it("runs a command on the editor that has its project open", async () => {
    const registry = createScreenRegistry();
    registry.register("p-1", async (command) => screenOk({ seen: command.name }));
    await expect(registry.run(read)).resolves.toEqual({ ok: true, data: { seen: "read" } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("declines a command for a project that stays closed through the grace period", async () => {
    vi.useFakeTimers();
    const registry = createScreenRegistry();
    registry.register("p-2", async () => screenOk());
    const pending = registry.run(read);
    await vi.advanceTimersByTimeAsync(EDITOR_GRACE_MS);
    expect(await pending).toMatchObject({ ok: false, error: { code: "no_editor" } });
  });

  it("hands a command to the editor that registers again while it remounts", async () => {
    vi.useFakeTimers();
    const registry = createScreenRegistry();
    const pending = registry.run(read);
    await vi.advanceTimersByTimeAsync(EDITOR_GRACE_MS / 2);
    registry.register("p-1", async (command) => screenOk({ seen: command.name }));
    expect(await pending).toEqual({ ok: true, data: { seen: "read" } });
  });

  it("turns an editor crash into a refusal the model can read", async () => {
    const registry = createScreenRegistry();
    registry.register("p-1", async () => {
      throw new Error("canvas lost");
    });
    expect(await registry.run(read)).toMatchObject({ ok: false, error: { code: "editor_failed" } });
  });

  it("only lets the editor that registered remove itself", async () => {
    const registry = createScreenRegistry();
    const first = registry.register("p-1", async () => screenOk("first"));
    registry.register("p-1", async () => screenOk("second"));
    first();
    expect(registry.has("p-1")).toBe(true);
    expect(await registry.run(read)).toEqual({ ok: true, data: "second" });
  });
});

describe("screen protocol", () => {
  it("accepts only known commands with an id and a project", () => {
    expect(isScreenCommand(read)).toBe(true);
    expect(isScreenCommand({ ...read, name: "click" })).toBe(false);
    expect(isScreenCommand({ ...read, id: "" })).toBe(false);
    expect(isScreenCommand(null)).toBe(false);
  });

  it("keeps refusal codes in the shape the server accepts", () => {
    expect(screenRefusal("Clip Not Found", "x")).toEqual({ ok: false, error: { code: "refused", message: "x" } });
    expect(screenRefusal("clip_locked", "a".repeat(MAX_SCREEN_MESSAGE + 300))).toMatchObject({ error: { message: "a".repeat(MAX_SCREEN_MESSAGE) } });
  });

  it("carries the structured outcome of a refusal next to its message", () => {
    expect(screenRefusal("operation_refused", "Nada foi aplicado.", { applied: [] })).toEqual({ ok: false, error: { code: "operation_refused", message: "Nada foi aplicado." }, data: { applied: [] } });
  });

  it("sends images only when there are some", () => {
    expect(screenOk({ a: 1 }, [])).toEqual({ ok: true, data: { a: 1 } });
    expect(screenOk(undefined, ["data:image/jpeg;base64,AA"])).toEqual({ ok: true, data: undefined, images: ["data:image/jpeg;base64,AA"] });
  });

  it("names what the editor looked at beside the data, never inside it", () => {
    expect(screenOk({ a: 1 }, ["data:image/jpeg;base64,AA"], { kind: "moments", fromMs: 3000, toMs: 5000 })).toEqual({
      ok: true,
      data: { a: 1 },
      images: ["data:image/jpeg;base64,AA"],
      target: { kind: "moments", fromMs: 3000, toMs: 5000 },
    });
  });
});

describe("screen answers", () => {
  const command: ScreenCommand = { id: "cmd-1", name: "edit", projectId: "p-1" };
  const instantly = async () => undefined;
  const allow = async () => true;

  it("runs a command once even when a reconnecting stream replays it while it is still running", async () => {
    let finish: (reply: ScreenReply) => void = () => undefined;
    const run = vi.fn(() => new Promise<ScreenReply>((resolve) => (finish = resolve)));
    const post = vi.fn(async (): Promise<ReplyDelivery> => "delivered");
    const answer = createScreenAnswerer({ run, post, claim: allow, wait: instantly });
    const first = answer("th1", command);
    const replayed = answer("th1", command);
    finish(screenOk({ applied: 1 }));
    await Promise.all([first, replayed]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("keeps posting a reply the server did not receive, and stops once the command is gone", async () => {
    const post = vi.fn<() => Promise<ReplyDelivery>>().mockResolvedValueOnce("retry").mockResolvedValueOnce("retry").mockResolvedValueOnce("delivered");
    await createScreenAnswerer({ run: async () => screenOk(), post, claim: allow, wait: instantly })("th1", command);
    expect(post).toHaveBeenCalledTimes(3);
    const gone = vi.fn(async (): Promise<ReplyDelivery> => "gone");
    await createScreenAnswerer({ run: async () => screenOk(), post: gone, claim: allow, wait: instantly })("th1", command);
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it("answers a command replayed after its reply was lost with the same reply, without running it again", async () => {
    const run = vi.fn(async () => screenOk({ applied: 2 }));
    const post = vi.fn(async (): Promise<ReplyDelivery> => "retry");
    const answer = createScreenAnswerer({ run, post, claim: allow, wait: instantly });
    await answer("th1", command);
    post.mockResolvedValue("delivered");
    await answer("th1", command);
    expect(run).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenLastCalledWith("th1", "cmd-1", screenOk({ applied: 2 }));
  });

  it("runs the command knowing the chat thread it came from", async () => {
    const run = vi.fn(async () => screenOk());
    await createScreenAnswerer({ run, post: async () => "delivered", claim: allow, wait: instantly })("th1", command);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ ...command, threadId: "th1" }));
  });

  it("hands the command a claim bound to its thread and id", async () => {
    const claim = vi.fn(async () => true);
    let seen: ScreenCommand | null = null;
    await createScreenAnswerer({ run: async (c) => ((seen = c), screenOk()), post: async () => "delivered", claim, wait: instantly })("th1", command);
    await expect(mayApply(seen!)).resolves.toBe(true);
    expect(claim).toHaveBeenCalledWith("th1", "cmd-1");
  });
});

describe("claiming a change", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const claimant = "5f1c1a9e-8f7a-4c1e-9d55-3c2b8f0e6a11";

  it("lets the tab apply only when the turn sends go for its own claim", async () => {
    const signals = createGoSignals();
    const post = vi.fn(async () => true);
    const claim = createScreenClaimer({ post, signals, newClaimant: () => claimant, waitMs: 1000 });
    const pending = claim("th1", "cmd-1");
    await Promise.resolve();
    signals.arrive({ id: "cmd-1", claimant: "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" });
    signals.arrive({ id: "cmd-2", claimant });
    signals.arrive({ id: "cmd-1", claimant });
    await expect(pending).resolves.toBe(true);
    expect(post).toHaveBeenCalledWith("th1", "cmd-1", claimant);
  });

  it("applies nothing when the turn already gave up and never sends go", async () => {
    vi.useFakeTimers();
    const signals = createGoSignals();
    const claim = createScreenClaimer({ post: async () => true, signals, newClaimant: () => claimant, waitMs: 1000 });
    const pending = claim("th1", "cmd-1");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe(false);
    signals.arrive({ id: "cmd-1", claimant });
    await expect(pending).resolves.toBe(false);
  });

  it("applies nothing when the claim cannot be sent", async () => {
    const signals = createGoSignals();
    const failing = createScreenClaimer({ post: async () => false, signals, newClaimant: () => claimant, waitMs: 1000 });
    await expect(failing("th1", "cmd-1")).resolves.toBe(false);
    const throwing = createScreenClaimer({ post: () => Promise.reject(new Error("offline")), signals, newClaimant: () => claimant, waitMs: 1000 });
    await expect(throwing("th1", "cmd-1")).resolves.toBe(false);
  });

  it("reads only well formed go signals", () => {
    expect(isScreenGo({ id: "cmd-1", claimant })).toBe(true);
    expect(isScreenGo({ id: "", claimant })).toBe(false);
    expect(isScreenGo({ id: "cmd-1" })).toBe(false);
    expect(isScreenGo(null)).toBe(false);
  });

  it("applies freely where nobody hands out claims, like the offline design harness", async () => {
    await expect(mayApply(command)).resolves.toBe(true);
    expect(EXPIRED_REPLY).toMatchObject({ ok: false, error: { code: "expired" } });
  });

  const command: ScreenCommand = { id: "cmd-1", name: "edit", projectId: "p-1" };
});

const create: ScreenCommand = { id: "cmd-9", name: "create_project", projectId: "", args: { kind: "image" } };

describe("routing screen commands", () => {
  it("reads a create command even though it comes before any project", () => {
    expect(isScreenCommand(create)).toBe(true);
  });

  it("hands project creation to this tab's creator and every other command to the open editors", async () => {
    const editors = vi.fn(async () => screenOk({ editor: true }));
    const creator = vi.fn(async () => screenOk({ projectId: "p-9" }));
    const app = (name: string) => (name === "create_project" ? creator : null);
    await expect(routeScreenCommand(create, editors, app)).resolves.toEqual(screenOk({ projectId: "p-9" }));
    await expect(routeScreenCommand(read, editors, app)).resolves.toEqual(screenOk({ editor: true }));
    expect(editors).toHaveBeenCalledTimes(1);
    expect(creator).toHaveBeenCalledTimes(1);
  });

  it("hands opening a design to this tab's opener, never to an editor", async () => {
    const editors = vi.fn(async () => screenOk());
    const opener = vi.fn(async () => screenOk({ opened: true }));
    const open: ScreenCommand = { id: "cmd-7", name: "open_design", projectId: "", args: { designId: "d-1" } };
    expect(isScreenCommand(open)).toBe(true);
    await expect(routeScreenCommand(open, editors, (name) => (name === "open_design" ? opener : null))).resolves.toEqual(screenOk({ opened: true }));
    expect(editors).not.toHaveBeenCalled();
  });

  it("lets another tab create the project when this one cannot, and reads a crash as a refusal", async () => {
    const editors = vi.fn(async () => screenOk());
    expect(await routeScreenCommand(create, editors, () => null)).toMatchObject({ ok: false, error: { code: "no_editor" } });
    const crashed = await routeScreenCommand(create, editors, () => async () => {
      throw new Error("sem rede");
    });
    expect(crashed).toMatchObject({ ok: false, error: { code: "editor_failed" } });
    expect(editors).not.toHaveBeenCalled();
  });
});

describe("creating once across tabs", () => {
  function sharedLocks(): TabLocks {
    const held = new Set<string>();
    return {
      request: async (key, _options, callback) => {
        if (held.has(key)) return callback(null);
        held.add(key);
        try {
          return await callback({});
        } finally {
          held.delete(key);
        }
      },
    };
  }

  it("creates in the tab that takes the command first and declines in the others", async () => {
    const locks = sharedLocks();
    let release: () => void = () => {};
    const slow = vi.fn(() => new Promise<ScreenReply>((resolve) => (release = () => resolve(screenOk({ projectId: "p-1" })))));
    const first = oncePerTabs("cmd-9", slow, locks);
    const second = await oncePerTabs("cmd-9", slow, locks);
    expect(second).toMatchObject({ ok: false, error: { code: "no_editor" } });
    release();
    expect(await first).toEqual(screenOk({ projectId: "p-1" }));
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("creates directly where the browser has no shared locks", async () => {
    const run = vi.fn(async () => screenOk({ projectId: "p-2" }));
    expect(await oncePerTabs("cmd-9", run, undefined)).toEqual(screenOk({ projectId: "p-2" }));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
