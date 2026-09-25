import { describe, expect, it } from "vitest";

import { keepAppLinks, resolveAppLink } from "./app-links";

const id = "9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

describe("resolveAppLink", () => {
  it("turns a campaign reference into the campaign page", () => {
    expect(resolveAppLink(`campaign:${id}`)).toEqual({ kind: "internal", path: `/dashboard/whatsapp-campaigns/${id}` });
  });

  it("turns a conversation reference into the live chat with that conversation open", () => {
    expect(resolveAppLink(`conversation:instagram:${id}`)).toEqual({
      kind: "internal",
      path: `/dashboard/live-chat?entry=${id}&type=instagram`,
    });
  });

  it("refuses a conversation reference with an unknown channel or a crafted id", () => {
    for (const href of [`conversation:fax:${id}`, "conversation:whatsapp:../x", `conversation:${id}`, "conversation:whatsapp:a?b=c"]) {
      expect(resolveAppLink(href)).toBeNull();
    }
  });

  it("keeps ordinary web links as external links", () => {
    expect(resolveAppLink("https://www.gov.br/receita")).toEqual({ kind: "external", href: "https://www.gov.br/receita" });
  });

  it("refuses anything it did not issue, so text from a conversation cannot plant a link", () => {
    for (const href of [
      "campaign:../../settings",
      "campaign:black-friday",
      "/dashboard/billing",
      "//evil.example/login",
      "javascript:alert(1)",
      "data:text/html,hi",
      "mailto:x@y.z",
      "",
      undefined,
    ]) {
      expect(resolveAppLink(href)).toBeNull();
    }
  });
});

describe("keepAppLinks", () => {
  it("lets campaign references through the markdown sanitizer and still strips scripts", () => {
    expect(keepAppLinks(`campaign:${id}`)).toBe(`campaign:${id}`);
    expect(keepAppLinks(`conversation:whatsapp:${id}`)).toBe(`conversation:whatsapp:${id}`);
    expect(keepAppLinks("javascript:alert(1)")).toBe("");
  });
});
