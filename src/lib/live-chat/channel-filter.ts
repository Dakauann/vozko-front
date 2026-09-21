import type { CampaignType, EntryType } from "@/lib/conversations/types";


export type ChannelFilter =
    | "all"
    | "whatsapp"
    | "instagram"
    | "telegram"
    | "unofficial_whatsapp";

export type ChannelFilterKind = "all" | "campaign" | "entry";

export interface ChannelFilterSpec {
    value: ChannelFilter;
    kind: ChannelFilterKind;
    labelKey: string;
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

export function isCampaignChannel(filter: ChannelFilter): boolean {
    return channelFilterSpec(filter)?.kind === "campaign";
}

export function campaignTypeFor(filter: ChannelFilter): CampaignType | undefined {
    return isCampaignChannel(filter) ? (filter as CampaignType) : undefined;
}

export function entryTypeFor(filter: ChannelFilter): EntryType | undefined {
    return channelFilterSpec(filter)?.kind === "entry"
        ? (filter as EntryType)
        : undefined;
}
