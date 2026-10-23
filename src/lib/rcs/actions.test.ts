import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import {
  checkRcsContentAction,
  createRcsSenderAction,
  getRcsSenderAction,
  listRcsSendersAction,
  resolveRcsMediaAction,
  transitionRcsSenderAction,
  updateRcsSenderAction,
} from "@/app/actions/rcs";
import { EMPTY_SENDER_INPUT } from "@/lib/rcs/sender-form";
import { senderFixture } from "@/lib/rcs/test-fixtures";

beforeEach(() => {
  client.apiClient.mockReset();
});

describe("RCS sender actions", () => {
  it("lists the workspace senders", async () => {
    client.apiClient.mockResolvedValue({ data: { senders: [senderFixture()] } });
    const result = await listRcsSendersAction();
    expect(client.apiClient).toHaveBeenCalledWith("/rcs/senders", { method: "GET", signal: undefined });
    expect(result).toEqual({ data: { senders: [senderFixture()] }, error: null });
  });

  it("reads one sender by its escaped id", async () => {
    client.apiClient.mockResolvedValue({ data: senderFixture() });
    await getRcsSenderAction("a/b");
    expect(client.apiClient).toHaveBeenCalledWith("/rcs/senders/a%2Fb", { method: "GET", signal: undefined });
  });

  it("creates a draft and edits it", async () => {
    client.apiClient.mockResolvedValue({ data: senderFixture({ status: "draft" }) });
    await createRcsSenderAction(EMPTY_SENDER_INPUT);
    expect(client.apiClient).toHaveBeenLastCalledWith("/rcs/senders", { method: "POST", body: JSON.stringify(EMPTY_SENDER_INPUT) });
    await updateRcsSenderAction("snd-1", { brand_name: "Sol" });
    expect(client.apiClient).toHaveBeenLastCalledWith("/rcs/senders/snd-1", { method: "PATCH", body: JSON.stringify({ brand_name: "Sol" }) });
  });

  it("submits, pauses and resumes through their own routes", async () => {
    client.apiClient.mockResolvedValue({ data: senderFixture() });
    for (const transition of ["submit", "pause", "resume"] as const) {
      await transitionRcsSenderAction("snd-1", transition);
      expect(client.apiClient).toHaveBeenLastCalledWith(`/rcs/senders/snd-1/${transition}`, { method: "POST" });
    }
  });

  it("passes the coded refusal through", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "x", code: "sector_refused", status: 422, details: { field: "sector" } } });
    const result = await createRcsSenderAction(EMPTY_SENDER_INPUT);
    expect(result).toEqual({ data: null, error: { message: "x", code: "sector_refused", status: 422, details: { field: "sector" } } });
  });

  it("refuses a sender body it cannot read", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "snd-1" } });
    const result = await getRcsSenderAction("snd-1");
    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: "Empty response" });
  });
});

describe("RCS content actions", () => {
  it("asks the backend for the verdict on a message", async () => {
    const check = { kind: "text", billing_class: "basic", variable_slots: 0, issues: [], price: { charge_kind: "rcs_basic", unit_micros: 1, quantity: 1, total_micros: 1 } };
    client.apiClient.mockResolvedValue({ data: check });
    const controller = new AbortController();
    const result = await checkRcsContentAction({ content: { text: "Oi" } }, controller.signal);
    expect(client.apiClient).toHaveBeenCalledWith("/rcs/content/check", {
      method: "POST",
      body: JSON.stringify({ content: { text: "Oi" } }),
      signal: controller.signal,
    });
    expect(result.data).toEqual(check);
  });

  it("resolves a library file into an RCS media file", async () => {
    const media = { kind: "image", url: "https://cdn.example/a.png", mime_type: "image/png" };
    client.apiClient.mockResolvedValue({ data: media });
    const result = await resolveRcsMediaAction({ media_id: "med-1" });
    expect(client.apiClient).toHaveBeenCalledWith("/rcs/media", { method: "POST", body: JSON.stringify({ media_id: "med-1" }) });
    expect(result.data).toEqual(media);
  });
});
