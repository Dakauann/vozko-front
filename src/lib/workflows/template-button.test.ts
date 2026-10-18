import { describe, expect, it } from "vitest";

import { TEMPLATE_BUTTON_POSITIONS, templateButtonCondition, templateButtonIndexOf } from "./template-button";

describe("template button branch", () => {
  it("writes the condition the backend routes a template tap on, with the 0-based button index", () => {
    expect(templateButtonCondition(0)).toEqual({
      variable: "{{selected_option_id}}",
      operator: "eq",
      value: "template_button:0",
    });
    expect(templateButtonCondition(2).value).toBe("template_button:2");
  });

  it("reads the button back from a condition that routes on it", () => {
    expect(templateButtonIndexOf(templateButtonCondition(1))).toBe(1);
    expect(templateButtonIndexOf({ variable: " {{selected_option_id}} ", operator: "eq", value: "template_button:3" })).toBe(3);
  });

  it("does not read a button from any other condition", () => {
    expect(templateButtonIndexOf({ variable: "{{selected_option_id}}", operator: "contains", value: "template_button:1" })).toBeNull();
    expect(templateButtonIndexOf({ variable: "{{message}}", operator: "eq", value: "template_button:1" })).toBeNull();
    expect(templateButtonIndexOf({ variable: "{{selected_option_id}}", operator: "eq", value: "template_button" })).toBeNull();
    expect(templateButtonIndexOf({ variable: "{{selected_option_id}}", operator: "eq", value: "template_button:x" })).toBeNull();
    expect(templateButtonIndexOf({})).toBeNull();
  });

  it("offers every position a template can hold", () => {
    expect(TEMPLATE_BUTTON_POSITIONS).toHaveLength(10);
    expect(TEMPLATE_BUTTON_POSITIONS[0]).toBe(0);
  });
});
