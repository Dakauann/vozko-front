import { describe, expect, it } from "vitest";

import type { ModelPricingInfo } from "@/lib/agents/types";

import { blindModelNeed, visionNeed } from "./vision-need";

const image = { mediaId: "m1", name: "logo.png", kind: "image", url: "https://cdn/logo.png" };
const document = { mediaId: "m2", name: "lista.csv", kind: "document", url: "https://cdn/lista.csv" };

describe("visionNeed", () => {
  it("needs vision for an attached image first", () => {
    expect(visionNeed({ studio: true, pathname: "/pt/dashboard/advertising/new", attachments: [image] })).toBe("image");
  });

  it("needs vision in the Studio, where Elo looks at the canvas", () => {
    expect(visionNeed({ studio: true, pathname: null, attachments: [] })).toBe("studio");
  });

  it("needs vision on the advertising screens, where Elo works with creatives", () => {
    expect(visionNeed({ studio: false, pathname: "/pt/dashboard/advertising/editor/abc", attachments: [document] })).toBe("ads");
    expect(visionNeed({ studio: false, pathname: "/dashboard/advertising", attachments: [] })).toBe("ads");
  });

  it("needs nothing elsewhere", () => {
    expect(visionNeed({ studio: false, pathname: "/pt/dashboard/leads", attachments: [document] })).toBeNull();
    expect(visionNeed({ studio: false, pathname: null, attachments: [{ ...image, url: undefined }] })).toBeNull();
  });
});

describe("blindModelNeed", () => {
  const pricing: ModelPricingInfo[] = [
    { id: "lab/seer", name: "Seer", promptPrice: 1, completionPrice: 1, capabilities: ["vision", "tools"] },
    { id: "lab/blind", name: "Blind", promptPrice: 1, completionPrice: 1, capabilities: ["tools"] },
  ];

  it("warns only when the chosen model cannot see and vision is needed", () => {
    expect(blindModelNeed("lab/blind", pricing, "studio")).toBe("studio");
    expect(blindModelNeed("lab/seer", pricing, "studio")).toBeNull();
    expect(blindModelNeed("lab/blind", pricing, null)).toBeNull();
  });

  it("treats a model the catalog does not describe as unable to see", () => {
    expect(blindModelNeed("lab/unknown", pricing, "image")).toBe("image");
  });

  it("waits for the catalog before warning", () => {
    expect(blindModelNeed("lab/blind", [], "image")).toBeNull();
    expect(blindModelNeed("", pricing, "image")).toBeNull();
  });
});
