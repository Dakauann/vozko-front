import { afterEach, describe, expect, it, vi } from "vitest";

import { createScreenAnswerer, createScreenRegistry, EDITOR_GRACE_MS, isScreenCommand, MAX_SCREEN_MESSAGE, screenOk, screenRefusal, type ReplyDelivery, type ScreenCommand, type ScreenReply } from "./screen";

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

  it("sends images only when there are some", () => {
    expect(screenOk({ a: 1 }, [])).toEqual({ ok: true, data: { a: 1 } });
    expect(screenOk(undefined, ["data:image/jpeg;base64,AA"])).toEqual({ ok: true, data: undefined, images: ["data:image/jpeg;base64,AA"] });
  });
});

describe("screen answers", () => {
  const command: ScreenCommand = { id: "cmd-1", name: "edit", projectId: "p-1" };
  const instantly = async () => undefined;

  it("runs a command once even when a reconnecting stream replays it while it is still running", async () => {
    let finish: (reply: ScreenReply) => void = () => undefined;
    const run = vi.fn(() => new Promise<ScreenReply>((resolve) => (finish = resolve)));
    const post = vi.fn(async (): Promise<ReplyDelivery> => "delivered");
    const answer = createScreenAnswerer({ run, post, wait: instantly });
    const first = answer("th1", command);
    const replayed = answer("th1", command);
    finish(screenOk({ applied: 1 }));
    await Promise.all([first, replayed]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("keeps posting a reply the server did not receive, and stops once the command is gone", async () => {
    const post = vi.fn<() => Promise<ReplyDelivery>>().mockResolvedValueOnce("retry").mockResolvedValueOnce("retry").mockResolvedValueOnce("delivered");
    await createScreenAnswerer({ run: async () => screenOk(), post, wait: instantly })("th1", command);
    expect(post).toHaveBeenCalledTimes(3);
    const gone = vi.fn(async (): Promise<ReplyDelivery> => "gone");
    await createScreenAnswerer({ run: async () => screenOk(), post: gone, wait: instantly })("th1", command);
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it("answers a command replayed after its reply was lost with the same reply, without running it again", async () => {
    const run = vi.fn(async () => screenOk({ applied: 2 }));
    const post = vi.fn(async (): Promise<ReplyDelivery> => "retry");
    const answer = createScreenAnswerer({ run, post, wait: instantly });
    await answer("th1", command);
    post.mockResolvedValue("delivered");
    await answer("th1", command);
    expect(run).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenLastCalledWith("th1", "cmd-1", screenOk({ applied: 2 }));
  });
});
