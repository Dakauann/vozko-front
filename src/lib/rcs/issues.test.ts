import { describe, expect, it } from "vitest";

import { cardPath, issuesAt, issuesUnder, messageIssues, suggestionPath } from "@/lib/rcs/issues";

const issues = [
  { code: "rcs_content_empty", path: "" },
  { code: "rcs_text_too_long", path: "text" },
  { code: "rcs_card_title_too_long", path: "cards[1].title" },
  { code: "rcs_button_invalid", path: "cards[1].suggestions[0]" },
  { code: "rcs_too_many_buttons", path: "cards[1].suggestions" },
  { code: "rcs_button_invalid", path: "suggestions[3]" },
  { code: "rcs_card_empty", path: "cards[10]" },
];

describe("issue paths", () => {
  it("builds the bracket paths the backend reports", () => {
    expect(cardPath(1)).toBe("cards[1]");
    expect(cardPath(1, "title")).toBe("cards[1].title");
    expect(cardPath(1, "suggestions")).toBe("cards[1].suggestions");
    expect(suggestionPath(-1, 3)).toBe("suggestions[3]");
    expect(suggestionPath(1, 0)).toBe("cards[1].suggestions[0]");
  });

  it("finds the issues of one field", () => {
    expect(issuesAt(issues, "text").map((issue) => issue.code)).toEqual(["rcs_text_too_long"]);
    expect(issuesAt(issues, "cards[0].title")).toEqual([]);
  });

  it("finds every issue inside a card without leaking into card 10", () => {
    expect(issuesUnder(issues, "cards[1]").map((issue) => issue.path)).toEqual(["cards[1].title", "cards[1].suggestions[0]", "cards[1].suggestions"]);
    expect(issuesUnder(issues, "cards[1].suggestions[0]")).toHaveLength(1);
  });

  it("separates issues that belong to the whole message", () => {
    expect(messageIssues(issues).map((issue) => issue.code)).toEqual(["rcs_content_empty"]);
  });
});
