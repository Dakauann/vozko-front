const FENCE = "```";
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const SENTENCE_END = /[.!?…:;](?=\s)|\n/g;
const VOICE_TIERS = [/natural|neural|premium|enhanced/i, /google|online/i];

const SPEECH_LANGS: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

export function speechLang(locale: string): string {
  return SPEECH_LANGS[locale] ?? SPEECH_LANGS.pt;
}

function speakableLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("|") || /^[-*_]{3,}$/.test(trimmed) || trimmed.startsWith(FENCE)) return "";
  return trimmed
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^([-*+]|\d+[.)])\s+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(UUID, "")
    .replace(/[*_`~]+/g, "");
}

export function speakableText(markdown: string): string {
  const lines: string[] = [];
  let inCode = false;
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith(FENCE)) {
      inCode = !inCode;
      continue;
    }
    if (!inCode) lines.push(speakableLine(line));
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function insideCode(text: string, end: number): boolean {
  return (text.slice(0, end).split(FENCE).length - 1) % 2 === 1;
}

export function nextSentences(text: string, from: number, final: boolean): { sentences: string[]; next: number } {
  const sentences: string[] = [];
  let start = from;
  const push = (end: number) => {
    const spoken = insideCode(text, start) ? "" : speakableText(text.slice(start, end));
    if (spoken) sentences.push(spoken);
    start = end;
  };
  SENTENCE_END.lastIndex = from;
  for (let match = SENTENCE_END.exec(text); match; match = SENTENCE_END.exec(text)) {
    push(match.index + match[0].length);
  }
  if (final && start < text.length) push(text.length);
  return { sentences, next: start };
}

export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const family = lang.split("-")[0].toLowerCase();
  const normalized = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
  const exact = voices.filter((v) => normalized(v) === lang.toLowerCase());
  const related = voices.filter((v) => normalized(v).split("-")[0] === family);
  for (const pool of [exact, related]) {
    for (const tier of VOICE_TIERS) {
      const match = pool.find((v) => tier.test(v.name));
      if (match) return match;
    }
    if (pool[0]) return pool[0];
  }
  return null;
}

export function appendDictation(draft: string, spoken: string): string {
  const text = spoken.trim();
  if (!text) return draft;
  const base = draft.trimEnd();
  return base ? `${base} ${text}` : text;
}
