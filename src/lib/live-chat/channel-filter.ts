import type { CampaignType, EntryType } from "@/lib/conversations/types";

/**
 * The CRM's channel filter, as data.
 *
 * It used to be three inline ternaries in LiveChatClient — one deciding whether
 * the filter is a campaign channel, one deriving the campaignType, one deriving
 * the channelFilter — plus a fourth list for the buttons. Adding a channel meant
 * editing four places and hoping, and the failure mode is silent: miss the
 * channelFilter ternary and the new channel selects nothing while still looking
 * like a working filter.
 *
 * One table, three readers. Adding a channel is a row.
 */

export type ChannelFilter =
    | "all"
    | "whatsapp"
    | "voice"
    | "instagram"
    | "telegram"
    | "unofficial_whatsapp";

/**
 * How a filter narrows the inbox — and they are genuinely different mechanisms,
 * not a style choice:
 *
 *  - "all"      narrows nothing.
 *  - "campaign" narrows by campaign type, because WhatsApp Cloud and voice
 *               conversations are reached through campaigns; these filters also
 *               show the campaign picker.
 *  - "entry"    narrows by the conversation's entry_type. Instagram, Telegram
 *               and unofficial WhatsApp are channels you filter directly.
 *
 * Unofficial WhatsApp is "entry" even though it is ALSO a valid CampaignType.
 * Filtering by channel is what the operator asked the button for: show me the
 * conversations on this number. Campaign-level narrowing for it is a separate
 * feature with its own picker, not a different reading of this button.
 */
export type ChannelFilterKind = "all" | "campaign" | "entry";

export interface ChannelFilterSpec {
    value: ChannelFilter;
    kind: ChannelFilterKind;
    /** Key into the page's translations; the label is never built here. */
    labelKey: string;
    /** Permission that gates the option, when one does. */
    permission?: { resource: string; action: string };
}

export const CHANNEL_FILTERS: readonly ChannelFilterSpec[] = [
    { value: "all", kind: "all", labelKey: "filterAll" },
    {
        value: "whatsapp",
        kind: "campaign",
        labelKey: "filterWhatsapp",
        permission: { resource: "whatsapp_campaigns", action: "read" },
    },
    {
        value: "unofficial_whatsapp",
        kind: "entry",
        labelKey: "filterUnofficialWhatsapp",
        permission: { resource: "unofficial_whatsapp_instances", action: "read" },
    },
    {
        value: "instagram",
        kind: "entry",
        labelKey: "filterInstagram",
        permission: { resource: "instagram_accounts", action: "read" },
    },
    {
        value: "telegram",
        kind: "entry",
        labelKey: "filterTelegram",
        permission: { resource: "telegram_accounts", action: "read" },
    },
] as const;

const BY_VALUE = new Map(CHANNEL_FILTERS.map((spec) => [spec.value, spec]));

export function channelFilterSpec(filter: ChannelFilter): ChannelFilterSpec | undefined {
    return BY_VALUE.get(filter);
}

/**
 * Whether this filter selects by campaign — which is also what decides if the
 * campaign picker is shown.
 *
 * "voice" has no row in CHANNEL_FILTERS (it is not offered as a button) but is
 * still reachable as state, so it is answered from the union rather than the
 * table.
 */
export function isCampaignChannel(filter: ChannelFilter): boolean {
    if (filter === "voice") return true;
    return channelFilterSpec(filter)?.kind === "campaign";
}

/** The campaignType this filter implies, if any. */
export function campaignTypeFor(filter: ChannelFilter): CampaignType | undefined {
    return isCampaignChannel(filter) ? (filter as CampaignType) : undefined;
}

/**
 * The entry_type this filter narrows to, if any.
 *
 * Campaign filters return undefined on purpose: narrowing by BOTH campaign type
 * and entry type would ask the inbox for conversations that satisfy two
 * overlapping constraints, and the intersection is not what the button promises.
 */
export function entryTypeFor(filter: ChannelFilter): EntryType | undefined {
    return channelFilterSpec(filter)?.kind === "entry"
        ? (filter as EntryType)
        : undefined;
}
