import { describe, expect, it } from "vitest";

import {
    CHANNEL_FILTERS,
    campaignTypeFor,
    channelFilterSpec,
    entryTypeFor,
    isCampaignChannel,
    type ChannelFilter,
} from "@/lib/live-chat/channel-filter";

describe("channel filter table", () => {
    it("offers unofficial WhatsApp as its own channel", () => {
        const spec = channelFilterSpec("unofficial_whatsapp");
        expect(spec).toBeDefined();
        expect(spec?.kind).toBe("entry");
        expect(spec?.permission).toEqual({
            resource: "unofficial_whatsapp_instances",
            action: "read",
        });
    });

    // The two WhatsApp transports must stay separate options. They share nothing
    // on the send path — no template, no 24h window on the unofficial one — so a
    // single "WhatsApp" filter would hide that difference exactly where an
    // operator is deciding which conversation to open.
    it("keeps the two WhatsApp transports as distinct filters", () => {
        const values = CHANNEL_FILTERS.map((spec) => spec.value);
        expect(values).toContain("whatsapp");
        expect(values).toContain("unofficial_whatsapp");
        expect(new Set(values).size).toBe(values.length);
    });

    it("gives every option a label key", () => {
        for (const spec of CHANNEL_FILTERS) {
            expect(spec.labelKey, spec.value).toBeTruthy();
        }
    });

    it("gates every real channel behind a permission, and only 'all' without one", () => {
        for (const spec of CHANNEL_FILTERS) {
            if (spec.value === "all") {
                expect(spec.permission).toBeUndefined();
            } else {
                expect(spec.permission, spec.value).toBeDefined();
            }
        }
    });
});

describe("narrowing", () => {
    // The bug this guards: a channel added to the button list but missed in the
    // entry-type derivation looks like a working filter and selects nothing.
    it("narrows every entry-kind filter by its entry type", () => {
        for (const spec of CHANNEL_FILTERS.filter((s) => s.kind === "entry")) {
            expect(entryTypeFor(spec.value), spec.value).toBe(spec.value);
            expect(campaignTypeFor(spec.value), spec.value).toBeUndefined();
        }
    });

    it("narrows campaign-kind filters by campaign type instead", () => {
        expect(campaignTypeFor("whatsapp")).toBe("whatsapp");
        expect(entryTypeFor("whatsapp")).toBeUndefined();
        expect(isCampaignChannel("whatsapp")).toBe(true);
    });

    it("routes unofficial WhatsApp by entry type, not campaign type", () => {
        expect(entryTypeFor("unofficial_whatsapp")).toBe("unofficial_whatsapp");
        expect(campaignTypeFor("unofficial_whatsapp")).toBeUndefined();
        expect(isCampaignChannel("unofficial_whatsapp")).toBe(false);
    });

    it("narrows nothing for 'all'", () => {
        expect(entryTypeFor("all")).toBeUndefined();
        expect(campaignTypeFor("all")).toBeUndefined();
        expect(isCampaignChannel("all")).toBe(false);
    });

    // Voice is reachable as state but is deliberately not offered as a button;
    // it must still resolve, or selecting it from elsewhere silently breaks.
    it("still resolves voice even though it has no button", () => {
        expect(channelFilterSpec("voice")).toBeUndefined();
        expect(isCampaignChannel("voice")).toBe(true);
        expect(campaignTypeFor("voice")).toBe("voice");
        expect(entryTypeFor("voice")).toBeUndefined();
    });

    // Exactly one narrowing per filter: asking the inbox for both a campaign
    // type and an entry type would return their intersection, which is not what
    // any of these buttons promises.
    it("never produces both narrowings at once", () => {
        const all: ChannelFilter[] = [
            "all",
            "whatsapp",
            "voice",
            "instagram",
            "telegram",
            "unofficial_whatsapp",
        ];
        for (const filter of all) {
            const both =
                campaignTypeFor(filter) !== undefined &&
                entryTypeFor(filter) !== undefined;
            expect(both, filter).toBe(false);
        }
    });
});
