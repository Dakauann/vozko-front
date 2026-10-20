import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const front = resolve(import.meta.dir, "..");
const source = resolve(front, "../vozko-back/domain/mercadolivre/message_text_rules.json");
const target = resolve(front, "src/lib/mercadolivre/message-text-rules.json");

const server = JSON.parse(readFileSync(source, "utf8")) as { maxRunes: number; emojiSource: string; emoji: unknown[] };
const copy = { maxRunes: server.maxRunes, emojiSource: server.emojiSource, emoji: server.emoji };
const lines = copy.emoji.map((entry) => `    ${JSON.stringify(entry)}`).join(",\n");
writeFileSync(target, `{\n  "maxRunes": ${copy.maxRunes},\n  "emojiSource": ${JSON.stringify(copy.emojiSource)},\n  "emoji": [\n${lines}\n  ]\n}\n`);
console.log(`wrote ${copy.emoji.length} emoji to ${target}`);
