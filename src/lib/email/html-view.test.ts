import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EMAIL_HTML_ERROR_CODES, emailFrameDocument, emailHasHTML } from "./html-view";

const GOLDEN = resolve(__dirname, "../../../../vozko-back/delivery/http/conversation/testdata/email_html_error_codes.golden");

describe("email html view", () => {
  it.skipIf(!existsSync(GOLDEN))("lists the refusal codes the backend declares in its golden file", () => {
    const golden = readFileSync(GOLDEN, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    expect([...EMAIL_HTML_ERROR_CODES].sort()).toEqual(golden.sort());
  });

  it("knows a row has html from its stored html or its campaign merge values", () => {
    expect(emailHasHTML({ metadata: { email_html_media_id: "h-1" } } as never)).toBe(true);
    expect(emailHasHTML({ metadata: { email_campaign_merge: { subject: "Oi" } } } as never)).toBe(true);
    expect(emailHasHTML({ metadata: { email_subject: "Oi" } } as never)).toBe(false);
  });

  it("lets the frame load remote images only when they are not blocked", () => {
    expect(emailFrameDocument("<p>oi</p>", false)).toContain("img-src data:;");
    expect(emailFrameDocument("<p>oi</p>", true)).toContain("img-src https: http: data:;");
  });
});
