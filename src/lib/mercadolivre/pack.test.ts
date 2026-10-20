import { describe, expect, it } from "vitest";

import {
  MERCADOLIVRE_ORDER_STATUSES,
  MERCADOLIVRE_SHIPPING_STATUSES,
  MERCADOLIVRE_SHIPPING_SUBSTATUSES,
  orderStatusLabel,
  orderStatusTone,
  packLoadOf,
  packMoney,
  shippingStatusLabel,
  shippingStatusTone,
  shippingSubstatusLabel,
} from "@/lib/mercadolivre/pack";
import type { MercadoLivrePackSummary } from "@/lib/mercadolivre/types";

const pack: MercadoLivrePackSummary = {
  items: [],
  orderStatus: "paid",
  shippingStatus: "shipped",
  total: 10,
  currency: "BRL",
  refreshedAt: "2026-10-19T10:00:00Z",
};

describe("Mercado Livre order statuses", () => {
  it("names every documented order status by its copy key", () => {
    for (const status of MERCADOLIVRE_ORDER_STATUSES) expect(orderStatusLabel(status)).toEqual({ key: `orderStatus.${status}` });
  });

  it("shows an unknown order status raw, in a neutral tone", () => {
    expect(orderStatusLabel("on_hold")).toEqual({ raw: "on_hold" });
    expect(orderStatusTone("on_hold")).toBe("muted");
  });

  it("shows nothing for a missing order status", () => {
    expect(orderStatusLabel("")).toBeNull();
    expect(orderStatusLabel("  ")).toBeNull();
  });

  it("marks paid as done, cancelled as failed and payment issues as attention", () => {
    expect(orderStatusTone("paid")).toBe("healthy");
    expect(orderStatusTone("cancelled")).toBe("fault");
    expect(orderStatusTone("invalid")).toBe("fault");
    expect(orderStatusTone("payment_required")).toBe("warning");
    expect(orderStatusTone("confirmed")).toBe("outline");
  });
});

describe("Mercado Livre shipping statuses", () => {
  it("names every documented shipping status and substatus by its copy key", () => {
    for (const status of MERCADOLIVRE_SHIPPING_STATUSES) expect(shippingStatusLabel(status)).toEqual({ key: `shippingStatus.${status}` });
    for (const substatus of MERCADOLIVRE_SHIPPING_SUBSTATUSES) expect(shippingSubstatusLabel(substatus)).toEqual({ key: `shippingSubstatus.${substatus}` });
  });

  it("shows unknown values raw and missing ones as nothing", () => {
    expect(shippingStatusLabel("teleported")).toEqual({ raw: "teleported" });
    expect(shippingStatusTone("teleported")).toBe("muted");
    expect(shippingSubstatusLabel("beamed_up")).toEqual({ raw: "beamed_up" });
    expect(shippingSubstatusLabel(undefined)).toBeNull();
    expect(shippingStatusLabel("")).toBeNull();
  });

  it("marks delivered as done and a failed delivery as failed", () => {
    expect(shippingStatusTone("delivered")).toBe("healthy");
    expect(shippingStatusTone("not_delivered")).toBe("fault");
    expect(shippingStatusTone("shipped")).toBe("outline");
  });

  it("keeps every catalog free of repeats", () => {
    for (const catalog of [MERCADOLIVRE_ORDER_STATUSES, MERCADOLIVRE_SHIPPING_STATUSES, MERCADOLIVRE_SHIPPING_SUBSTATUSES]) {
      expect(new Set(catalog).size).toBe(catalog.length);
    }
  });
});

describe("loading the sale summary", () => {
  it("shows a loaded summary", () => {
    expect(packLoadOf({ pack })).toEqual({ state: "ready", pack });
  });

  it("waits quietly while the summary is not stored yet", () => {
    expect(packLoadOf({ error: "loading", code: "pack_summary_pending", status: 404 })).toEqual({ state: "pending" });
  });

  it("hides the summary from someone who cannot read the conversation", () => {
    expect(packLoadOf({ error: "no", code: "forbidden", status: 403 })).toEqual({ state: "forbidden" });
  });

  it("reports any other failure, including a plain not found", () => {
    expect(packLoadOf({ error: "gone", status: 404 })).toEqual({ state: "failed" });
    expect(packLoadOf({ error: "boom", status: 500 })).toEqual({ state: "failed" });
  });
});

describe("formatting sale amounts", () => {
  it("formats an amount in its own currency for the reader's locale", () => {
    expect(packMoney(79.8, "BRL", "pt-BR").replace(/\s/g, " ")).toBe("R$ 79,80");
    expect(packMoney(1500, "ARS", "es-AR").replace(/\s/g, " ")).toBe("$ 1.500,00");
  });

  it("shows the empty value for an unknown currency", () => {
    expect(packMoney(10, "", "pt-BR")).toBe("n/d");
  });
});
