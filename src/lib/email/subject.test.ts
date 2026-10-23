import { describe, expect, it } from "vitest";

import type { ConversationMessage } from "@/lib/conversations/types";

import { latestEmailSubject } from "./subject";

function message(metadata: Record<string, unknown> | undefined): Pick<ConversationMessage, "metadata"> {
  return { metadata: metadata as ConversationMessage["metadata"] };
}

describe("latestEmailSubject", () => {
  it("takes the subject of the most recent message that carries one", () => {
    const thread = [
      message({ email_subject: "Orçamento" }),
      message({ email_subject: "Re: Orçamento" }),
      message(undefined),
      message({ email_subject: "" }),
      message({ email_subject: "   " }),
    ];
    expect(latestEmailSubject(thread)).toBe("Re: Orçamento");
  });

  it("names no subject when no message carries a non-empty one", () => {
    expect(latestEmailSubject([])).toBeNull();
    expect(latestEmailSubject([message(undefined), message({ email_subject: 42 }), message({ template_name: "x" })])).toBeNull();
  });
});
