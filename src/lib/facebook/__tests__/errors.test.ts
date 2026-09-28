import { describe, expect, it } from "vitest";

import { FACEBOOK_ERROR_CODES, facebookErrorKey } from "@/lib/facebook/errors";

describe("facebookErrorKey", () => {
    it("maps every stable backend code to its own message key", () => {
        for (const code of FACEBOOK_ERROR_CODES) {
            expect(facebookErrorKey(code)).toBe(`errors.${code}`);
        }
    });

    it("covers the codes the backend and the shared rule handler send", () => {
        for (const code of [
            "reconnect_required",
            "facebook_busy",
            "app_not_approved",
            "page_restricted",
            "facebook_rejected",
            "capability_denied",
            "thread_owned_elsewhere",
            "text_too_long",
            "comment_not_ours",
            "post_not_editable",
            "kind_unavailable",
            "delete_not_permitted",
            "invalid_post",
            "reel_limit",
            "profile_rate_limited",
            "private_reply_used",
            "private_reply_expired",
            "private_reply_deadline_unknown",
            "invalid_rule",
            "already_linked",
            "forbidden",
        ]) {
            expect(FACEBOOK_ERROR_CODES, code).toContain(code);
        }
    });

    it("returns null for codes it does not know, so the server message is shown instead", () => {
        expect(facebookErrorKey("something_new")).toBeNull();
        expect(facebookErrorKey(undefined)).toBeNull();
        expect(facebookErrorKey("not_found")).toBeNull();
    });
});
