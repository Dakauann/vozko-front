import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const startLeadActionAction = vi.fn();
const reviewLeadSendAction = vi.fn();
const startLeadSendAction = vi.fn();
const cancelLeadSendAction = vi.fn();

vi.mock("@/app/actions/lead-actions", () => ({
  startLeadActionAction: (...args: unknown[]) => startLeadActionAction(...args),
}));
vi.mock("@/app/actions/lead-sends", () => ({
  reviewLeadSendAction: (...args: unknown[]) => reviewLeadSendAction(...args),
  startLeadSendAction: (...args: unknown[]) => startLeadSendAction(...args),
  cancelLeadSendAction: (...args: unknown[]) => cancelLeadSendAction(...args),
}));

import type { LeadActionPreview, LeadActionRequest } from "@/lib/leads/actions";
import type { SendReview } from "@/lib/leads/sends";

import { useLeadSendFlow } from "../use-lead-send-flow";

function request(templateId = "tpl-1"): LeadActionRequest {
  return {
    action: "send_template",
    params: { send: { name: "Matrículas", businessPhoneId: "bp-1", templateId, bindings: [{ source: "lead.first_name" }] } },
    selection: { mode: "all_matching", filter: { groups: [] } },
  };
}

const preview: LeadActionPreview = {
  id: "p-1",
  action: "send_template",
  status: "done",
  result: { matched: 12, expectedCount: 12, fingerprint: "fp-12", selected: 12, eligible: 12, skipped: {} },
};

function review(campaignId = "c-1", started = false): SendReview {
  return {
    channel: "official",
    parts: [{ campaignId, name: "Matrículas", status: started ? "RUNNING" : "STOPPED", entries: 12, eligible: 10 }],
    entries: 12,
    eligible: 10,
    skipped: { blocked: 2 },
    counted: {},
    missingVariables: [],
    quote: {
      count: 10,
      parts: 1,
      splitRequired: false,
      maxPerCampaign: 150000,
      unitPriceMicros: 62500,
      costMicros: 625000,
      balanceMicros: 9000000,
      affordable: true,
      fits: 10,
    },
    started,
  };
}

function prepared(campaignId = "c-1") {
  return { data: { action: "send_template", send: review(campaignId) }, error: null };
}

function keyOfCall(index: number): string {
  return startLeadActionAction.mock.calls[index][1] as string;
}

describe("useLeadSendFlow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    startLeadActionAction.mockResolvedValue(prepared());
    cancelLeadSendAction.mockResolvedValue({ data: { cancelled: true }, error: null });
  });

  it("prepares the stopped send with the counted selection and one key for the opening", async () => {
    startLeadActionAction.mockResolvedValueOnce({ data: null, error: { code: "timeout" } }).mockResolvedValueOnce(prepared());
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));

    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request(), preview);
    });
    expect(outcome).toBe("failed");
    expect(result.current.failure?.code).toBe("timeout");

    await act(async () => {
      outcome = await result.current.prepare(request(), preview);
    });
    expect(outcome).toBe("ready");
    expect(result.current.review?.eligible).toBe(10);
    expect(startLeadActionAction).toHaveBeenCalledTimes(2);
    expect(keyOfCall(0)).toBe(keyOfCall(1));
    expect(startLeadActionAction.mock.calls[1][0].selection).toEqual({
      mode: "all_matching",
      filter: { groups: [] },
      expectedCount: 12,
      fingerprint: "fp-12",
    });
  });

  it("shows the same prepared send again when nothing changed", async () => {
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request(), preview);
    });
    await act(async () => {
      await result.current.prepare(request(), preview);
    });
    expect(startLeadActionAction).toHaveBeenCalledTimes(1);
    expect(cancelLeadSendAction).not.toHaveBeenCalled();
  });

  it("deletes the prepared send and takes a new key when the send changes", async () => {
    startLeadActionAction.mockResolvedValueOnce(prepared("c-1")).mockResolvedValueOnce(prepared("c-2"));
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request("tpl-1"), preview);
    });
    await act(async () => {
      await result.current.prepare(request("tpl-2"), preview);
    });
    expect(cancelLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"] });
    expect(keyOfCall(0)).not.toBe(keyOfCall(1));
    expect(result.current.review?.parts[0].campaignId).toBe("c-2");
  });

  it("keeps the old send and refuses to prepare another when it cannot be deleted", async () => {
    cancelLeadSendAction.mockResolvedValue({ data: null, error: { code: "send_campaign_not_found" } });
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request("tpl-1"), preview);
    });
    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request("tpl-2"), preview);
    });
    expect(outcome).toBe("failed");
    expect(startLeadActionAction).toHaveBeenCalledTimes(1);
  });

  it("gives every opening its own key", async () => {
    const first = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    const second = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await first.result.current.prepare(request(), preview);
      await second.result.current.prepare(request(), preview);
    });
    expect(keyOfCall(0)).not.toBe(keyOfCall(1));
  });

  it("asks again with the same key while the server is still preparing", async () => {
    startLeadActionAction
      .mockResolvedValueOnce({ data: null, error: { status: 409, code: "send_preparing" } })
      .mockResolvedValueOnce(prepared());
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request(), preview);
    });
    expect(outcome).toBe("ready");
    expect(keyOfCall(0)).toBe(keyOfCall(1));
  });

  it("tells the dialog the selection changed since the count", async () => {
    startLeadActionAction.mockResolvedValueOnce({ data: null, error: { status: 409, code: "selection_changed" } });
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request(), preview);
    });
    expect(outcome).toBe("changed");
    expect(result.current.failure).toBeNull();
  });

  it("starts the send for the first N and deletes nothing after it started", async () => {
    startLeadSendAction.mockResolvedValue({ data: review("c-1", true), error: null });
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request(), preview);
    });
    await act(async () => {
      await result.current.start(8);
    });
    expect(startLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"], firstN: 8 });
    await act(async () => {
      await result.current.discard();
    });
    expect(cancelLeadSendAction).not.toHaveBeenCalled();
  });

  it("re-reads the review when the budget refuses the start", async () => {
    startLeadSendAction.mockResolvedValue({ data: null, error: { status: 409, code: "unaffordable" } });
    const fresh = { ...review(), quote: { ...review().quote, fits: 6, refusal: "unaffordable" } };
    reviewLeadSendAction.mockResolvedValue({ data: fresh, error: null });
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request(), preview);
    });
    await act(async () => {
      await result.current.start();
    });
    expect(reviewLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"] });
    expect(result.current.review?.quote.fits).toBe(6);
    expect(result.current.failure?.code).toBe("unaffordable");
  });

  it("recovers and deletes what a failed review left behind before preparing a changed send", async () => {
    startLeadActionAction
      .mockResolvedValueOnce({ data: null, error: { status: 503, code: "analytics_busy" } })
      .mockResolvedValueOnce(prepared("c-1"))
      .mockResolvedValueOnce(prepared("c-2"));
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request("tpl-1"), preview);
    });
    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request("tpl-2"), preview);
    });
    expect(outcome).toBe("ready");
    expect(startLeadActionAction).toHaveBeenCalledTimes(3);
    expect(startLeadActionAction.mock.calls[1][0].params.send.templateId).toBe("tpl-1");
    expect(keyOfCall(1)).toBe(keyOfCall(0));
    expect(cancelLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"] });
    expect(startLeadActionAction.mock.calls[2][0].params.send.templateId).toBe("tpl-2");
    expect(keyOfCall(2)).not.toBe(keyOfCall(0));
    expect(result.current.review?.parts[0].campaignId).toBe("c-2");
  });

  it("does not resend a request the server refused before creating anything", async () => {
    startLeadActionAction.mockResolvedValueOnce({ data: null, error: { status: 400, code: "send_bindings_mismatch" } });
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request("tpl-1"), preview);
    });
    await act(async () => {
      await result.current.prepare(request("tpl-2"), preview);
    });
    expect(startLeadActionAction).toHaveBeenCalledTimes(2);
    expect(startLeadActionAction.mock.calls[1][0].params.send.templateId).toBe("tpl-2");
    expect(cancelLeadSendAction).not.toHaveBeenCalled();
  });

  it("deletes what a failed review left behind when the dialog closes", async () => {
    startLeadActionAction.mockResolvedValueOnce({ data: null, error: { code: "timeout" } }).mockResolvedValueOnce(prepared("c-1"));
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request(), preview);
    });
    let clean = false;
    await act(async () => {
      clean = await result.current.discard();
    });
    expect(clean).toBe(true);
    expect(keyOfCall(1)).toBe(keyOfCall(0));
    expect(cancelLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"] });
  });

  it("warns and moves on with a new key when what a failed review left cannot be recovered", async () => {
    const onLeftBehind = vi.fn();
    startLeadActionAction
      .mockResolvedValueOnce({ data: null, error: { status: 503, code: "analytics_busy" } })
      .mockResolvedValueOnce({ data: null, error: { status: 503, code: "analytics_busy" } })
      .mockResolvedValueOnce(prepared("c-2"));
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0, onLeftBehind }));
    await act(async () => {
      await result.current.prepare(request("tpl-1"), preview);
    });
    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request("tpl-2"), preview);
    });
    expect(outcome).toBe("ready");
    expect(onLeftBehind).toHaveBeenCalledTimes(1);
    expect(keyOfCall(2)).not.toBe(keyOfCall(0));
  });

  it("takes a new key and warns when the server says the key belongs to another request", async () => {
    const onLeftBehind = vi.fn();
    startLeadActionAction
      .mockResolvedValueOnce({ data: null, error: { status: 409, code: "idempotency_key_reused" } })
      .mockResolvedValueOnce(prepared("c-2"));
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0, onLeftBehind }));
    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request(), preview);
    });
    expect(outcome).toBe("ready");
    expect(onLeftBehind).toHaveBeenCalledTimes(1);
    expect(keyOfCall(1)).not.toBe(keyOfCall(0));
  });

  it("sends the person back to the department when the server asks for one", async () => {
    startLeadActionAction.mockResolvedValueOnce({ data: null, error: { status: 400, code: "send_department_required" } });
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    let outcome = "";
    await act(async () => {
      outcome = await result.current.prepare(request(), preview);
    });
    expect(outcome).toBe("department");
    expect(result.current.failure?.code).toBe("send_department_required");
  });

  it("deletes the prepared send when the dialog closes without sending", async () => {
    const { result } = renderHook(() => useLeadSendFlow({ retryDelayMs: 0 }));
    await act(async () => {
      await result.current.prepare(request(), preview);
    });
    let clean = false;
    await act(async () => {
      clean = await result.current.discard();
    });
    expect(clean).toBe(true);
    expect(cancelLeadSendAction).toHaveBeenCalledWith({ channel: "official", campaignIds: ["c-1"] });
  });
});
