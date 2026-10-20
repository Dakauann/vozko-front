import { describe, expect, it } from "vitest";

import { boardEntriesToInboxEntries, type CrmBoardEntry } from "@/lib/crm/board";

function card(overrides: Partial<CrmBoardEntry>): CrmBoardEntry {
    return { EntryID: "e-1", EntryType: "instagram", LeadName: "Maria", ...overrides };
}

describe("boardEntriesToInboxEntries", () => {
    it("keeps the channel the board names", () => {
        const [entry] = boardEntriesToInboxEntries([card({ EntryType: "telegram" })]);
        expect(entry).toMatchObject({ entry_id: "e-1", entry_type: "telegram", lead_name: "Maria" });
    });

    it("drops a card whose channel is missing or unknown, instead of opening it as WhatsApp", () => {
        const entries = boardEntriesToInboxEntries([
            card({ EntryID: "known", EntryType: "facebook" }),
            card({ EntryID: "missing", EntryType: undefined as unknown as string }),
            card({ EntryID: "unknown", EntryType: "fax" }),
        ]);
        expect(entries.map((e) => e.entry_id)).toEqual(["known"]);
    });
});
