import { describe, expect, it } from "vitest";

import { RCS_BUTTON_ACTIONS, buttonActionOf, newSuggestion, suggestionWithAction } from "@/lib/rcs/buttons";

describe("buttonActionOf", () => {
  it("names the six actions a button can take", () => {
    expect(RCS_BUTTON_ACTIONS).toEqual(["reply", "open_url", "webview", "dial", "view_location", "calendar"]);
  });

  it("tells a link that opens inside the chat from a link that opens the browser", () => {
    expect(buttonActionOf({ kind: "open_url", label: "Site", url: "https://a.example" })).toBe("open_url");
    expect(buttonActionOf({ kind: "open_url", label: "Site", url: "https://a.example", webview: true })).toBe("webview");
    expect(buttonActionOf({ kind: "dial", label: "Ligar", phone: "+55" })).toBe("dial");
  });
});

describe("suggestionWithAction", () => {
  it("keeps the label and drops the fields of the previous action", () => {
    expect(suggestionWithAction({ kind: "dial", label: "Fale conosco", phone: "+5511" }, "open_url")).toEqual({
      kind: "open_url",
      label: "Fale conosco",
      url: "",
    });
  });

  it("turns a link into an in chat page", () => {
    expect(suggestionWithAction({ kind: "open_url", label: "Loja", url: "https://loja.example" }, "webview")).toEqual({
      kind: "open_url",
      label: "Loja",
      url: "https://loja.example",
      webview: true,
    });
  });

  it("starts a calendar button with an empty event", () => {
    expect(suggestionWithAction({ kind: "reply", label: "Agendar" }, "calendar")).toEqual({
      kind: "calendar",
      label: "Agendar",
      calendar: { title: "", starts_at: "", ends_at: "" },
    });
  });

  it("starts a location button with empty coordinates", () => {
    expect(suggestionWithAction({ kind: "reply", label: "Onde estamos" }, "view_location")).toEqual({
      kind: "view_location",
      label: "Onde estamos",
      location_label: "",
    });
  });
});

describe("newSuggestion", () => {
  it("creates a quick reply with the given label", () => {
    expect(newSuggestion("Sim")).toEqual({ kind: "reply", label: "Sim" });
  });
});
