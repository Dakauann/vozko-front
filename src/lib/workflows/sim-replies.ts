import { isHttpsUrl } from "@/lib/facebook/composer";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import { isValidPosition } from "@/lib/maps/geometry";

export const SIM_MEDIA_KINDS = ["image", "video", "audio", "document", "sticker"] as const;

export type SimMediaKind = (typeof SIM_MEDIA_KINDS)[number];

export type SimCustomerReply =
  | { kind: "text"; text: string }
  | { kind: "selection"; choice: InteractiveChoice }
  | { kind: "location"; latitude: number; longitude: number; name?: string; address?: string }
  | { kind: "media"; media: SimMediaKind; url: string; caption?: string; filename?: string }
  | { kind: "form"; answers: Record<string, string> }
  | { kind: "form_unanswered" };

export interface SimReplyCommand {
  type: string;
  data: Record<string, unknown>;
}

export interface LocationDraft {
  latitude: string;
  longitude: string;
  name: string;
  address: string;
}

export interface MediaDraft {
  kind: SimMediaKind;
  url: string;
  caption: string;
}

function filled<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  const text = value?.trim() ?? "";
  return text === "" ? {} : ({ [key]: text } as Record<K, string>);
}

export function customerReplyCommand(reply: SimCustomerReply): SimReplyCommand {
  switch (reply.kind) {
    case "text":
      return { type: "reply", data: { text: reply.text } };
    case "selection":
      return { type: "reply_selection", data: { kind: reply.choice.kind, id: reply.choice.id, title: reply.choice.title } };
    case "location":
      return {
        type: "reply_location",
        data: { latitude: reply.latitude, longitude: reply.longitude, ...filled("name", reply.name), ...filled("address", reply.address) },
      };
    case "media":
      return {
        type: "reply_media",
        data: { kind: reply.media, url: reply.url, ...filled("filename", reply.filename), ...filled("caption", reply.caption) },
      };
    case "form":
      return { type: "form_reply", data: { answers: reply.answers } };
    case "form_unanswered":
      return { type: "form_reply", data: { outcome: "no_reply" } };
  }
}

function coordinate(raw: string): number {
  return raw.trim() === "" ? Number.NaN : Number(raw.trim());
}

export function locationReply(draft: LocationDraft): SimCustomerReply | null {
  const latitude = coordinate(draft.latitude);
  const longitude = coordinate(draft.longitude);
  if (!isValidPosition({ lat: latitude, lng: longitude })) return null;
  return { kind: "location", latitude, longitude, ...filled("name", draft.name), ...filled("address", draft.address) };
}

function fileNameOf(url: string): string | undefined {
  const last = new URL(url).pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || undefined;
  } catch {
    return last || undefined;
  }
}

export function mediaReply(draft: MediaDraft): SimCustomerReply | null {
  const url = draft.url.trim();
  if (!isHttpsUrl(url)) return null;
  return {
    kind: "media",
    media: draft.kind,
    url,
    ...(draft.kind === "document" ? filled("filename", fileNameOf(url)) : {}),
    ...(draft.kind === "sticker" ? {} : filled("caption", draft.caption)),
  };
}
