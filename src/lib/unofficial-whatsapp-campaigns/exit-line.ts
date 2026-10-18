import type { UnofficialWhatsAppMessageSpec } from "./types";

export const UNOFFICIAL_CAMPAIGN_NEEDS_EXIT = "unofficial_campaign_needs_exit";

const MAX_EXIT_WORD_LENGTH = 30;
const COMMAND = /(^|[\s"'“‘«([{])\/([\p{L}\p{Nd}_-]+)/gu;

export function exitWordsShownIn(text: string): string[] {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(COMMAND)) {
    const word = match[2];
    const key = word.toLocaleLowerCase();
    if (word.length > MAX_EXIT_WORD_LENGTH || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

function trimmed(texts: string[]): string[] {
  return texts.map((text) => text.trim()).filter((text) => text !== "");
}

export function shownTexts(spec: UnofficialWhatsAppMessageSpec): string[] {
  return spec.kind === "audio" ? trimmed([spec.exitText ?? ""]) : trimmed(spec.bodies);
}

export function messageShowsExit(spec: UnofficialWhatsAppMessageSpec): boolean {
  const shown = shownTexts(spec);
  return shown.length > 0 && shown.every((text) => exitWordsShownIn(text).length > 0);
}

function sameMessage(a: UnofficialWhatsAppMessageSpec, b: UnofficialWhatsAppMessageSpec): boolean {
  const shape = (spec: UnofficialWhatsAppMessageSpec) =>
    JSON.stringify([
      spec.kind,
      trimmed(spec.bodies),
      spec.mediaId ?? "",
      spec.fileName?.trim() ?? "",
      spec.style ?? "",
      spec.footer?.trim() ?? "",
      spec.button?.trim() ?? "",
      spec.options ?? [],
      spec.exitText?.trim() ?? "",
    ]);
  return shape(a) === shape(b);
}

export function messageExitPending(spec: UnofficialWhatsAppMessageSpec, saved?: UnofficialWhatsAppMessageSpec): boolean {
  if (saved && sameMessage(spec, saved)) return false;
  return !messageShowsExit(spec);
}

export function withExitLine(spec: UnofficialWhatsAppMessageSpec, line: string): UnofficialWhatsAppMessageSpec {
  if (spec.kind === "audio") return { ...spec, exitText: line };
  if (spec.bodies.length === 0) return { ...spec, bodies: [line] };
  const bodies = spec.bodies.map((body) => {
    if (exitWordsShownIn(body).length > 0) return body;
    return body.trim() === "" ? line : `${body.trimEnd()}\n\n${line}`;
  });
  return { ...spec, bodies };
}
