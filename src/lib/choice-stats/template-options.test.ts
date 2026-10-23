import { describe, expect, it } from "vitest";

import { choiceOptionLabels, templateButtonOptionId, templateChoiceOptions } from "./template-options";

describe("templateChoiceOptions", () => {
  it("names quick replies and URL buttons by their place among all buttons", () => {
    const options = templateChoiceOptions([
      { type: "BODY", text: "Oi" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Quero" },
          { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+55" },
          { type: "URL", text: "Ver site", url: "https://exemplo.com" },
        ],
      },
    ]);
    expect(options).toEqual([
      { optionId: "template_button:0", label: "Quero", kind: "quick_reply" },
      { optionId: "template_url:2", label: "Ver site", kind: "url" },
    ]);
  });

  it("has no options for a template without buttons", () => {
    expect(templateChoiceOptions([{ type: "BODY", text: "Oi" }])).toEqual([]);
  });

  it("builds the quick reply id the lead exit records", () => {
    expect(templateButtonOptionId(3)).toBe("template_button:3");
  });
});

describe("choiceOptionLabels", () => {
  it("names options by the canvas handle labels and the template buttons", () => {
    const labels = choiceOptionLabels([{ id: "sim", label: "Sim" }], [{ optionId: "template_url:1", label: "Ver site", kind: "url" }]);
    expect(labels.get("sim")).toBe("Sim");
    expect(labels.get("template_url:1")).toBe("Ver site");
    expect(labels.get("talvez")).toBeUndefined();
  });
});
