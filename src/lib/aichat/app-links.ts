import { defaultUrlTransform } from "react-markdown";

export type AppLink = { kind: "internal"; path: string } | { kind: "external"; href: string };

const CAMPAIGN = /^campaign:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function resolveAppLink(href: string | null | undefined): AppLink | null {
  const raw = href?.trim();
  if (!raw) return null;
  if (raw.startsWith("campaign:")) {
    const match = CAMPAIGN.exec(raw);
    return match ? { kind: "internal", path: `/dashboard/whatsapp-campaigns/${match[1]}` } : null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? { kind: "external", href: url.toString() } : null;
  } catch {
    return null;
  }
}

export function keepAppLinks(url: string): string {
  return url.startsWith("campaign:") ? url : defaultUrlTransform(url);
}
