import { describe, expect, it } from "vitest";

import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

import { trackedUrlButtons, urlTrackingFields, withTrackedUrls } from "./url-tracking";

const COMPONENTS: DraggableComponent[] = [
  { id: "body", type: "BODY", data: { text: "Oi" } },
  {
    id: "buttons",
    type: "BUTTONS",
    data: {
      buttons: [
        { id: "a", type: "QUICK_REPLY", text: "Quero", trackClicks: true },
        { id: "b", type: "URL", text: "Site", url: "https://exemplo.com", trackClicks: true },
        { id: "c", type: "URL", text: "Loja", url: "https://loja.exemplo.com" },
      ],
    },
  },
];

describe("url tracking", () => {
  it("lists only URL buttons that opted in, by their place among all buttons", () => {
    expect(trackedUrlButtons(COMPONENTS)).toEqual([1]);
  });

  it("sends nothing on create when no link is tracked", () => {
    expect(urlTrackingFields(withTrackedUrls(COMPONENTS, []), false)).toEqual({});
    expect(urlTrackingFields(COMPONENTS, false)).toEqual({ trackedUrlButtons: [1] });
  });

  it("always sends the list on edit when the template reported it, so turning tracking off is saved", () => {
    expect(urlTrackingFields(withTrackedUrls(COMPONENTS, []), true)).toEqual({ trackedUrlButtons: [] });
  });

  it("restores the saved choice onto the URL buttons only", () => {
    const restored = withTrackedUrls(COMPONENTS, [0, 2]);
    const buttons = restored[1].data.buttons!;
    expect(buttons.map((button) => Boolean(button.trackClicks))).toEqual([false, false, true]);
  });
});
