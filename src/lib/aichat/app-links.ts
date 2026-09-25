import { defaultUrlTransform } from "react-markdown";

import { conversationHref, isEntryId, isEntryType } from "@/lib/conversations/deep-link";

export type AppLink = { kind: "internal"; path: string } | { kind: "external"; href: string };

const CAMPAIGN = /^campaign:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const APP_SCHEMES = ["campaign:", "conversation:"];

export function resolveAppLink(href: string | null | undefined): AppLink | null {
  const raw = href?.trim();
  if (!raw) return null;
  if (raw.startsWith("campaign:")) {
    const match = CAMPAIGN.exec(raw);
    return match ? { kind: "internal", path: `/dashboard/whatsapp-campaigns/${match[1]}` } : null;
  }
  if (raw.startsWith("conversation:")) {
    return conversationLink(raw.slice("conversation:".length));
  }
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? { kind: "external", href: url.toString() } : null;
  } catch {
    return null;
  }
}

function conversationLink(reference: string): AppLink | null {
  const [entryType, entryId, ...rest] = reference.split(":");
  if (rest.length > 0 || !entryType || !entryId || !isEntryType(entryType) || !isEntryId(entryId)) return null;
  return { kind: "internal", path: conversationHref(entryId, entryType) };
}

export function keepAppLinks(url: string): string {
  return APP_SCHEMES.some((scheme) => url.startsWith(scheme)) ? url : defaultUrlTransform(url);
}
