import { offendingMessageCharacters, type OffendingCharacter } from "@/lib/mercadolivre/message-text";
import { refuseUnhandled } from "@/lib/exhaustive";
import type { TextCharset, TextLimit, TextLimitUnit } from "./types";

export interface TextLimitState {
    count: number;
    limit: number;
    unit: TextLimitUnit;
    over: boolean;
    near: boolean;
    refused: boolean;
    offending: readonly OffendingCharacter[];
}

const NEAR_RATIO = 0.9;

export const TEXT_LIMIT_COPY: Record<TextLimitUnit, "textLimit" | "textLimitBytes"> = {
    characters: "textLimit",
    bytes: "textLimitBytes",
};

const utf8 = new TextEncoder();

function measure(text: string, unit: TextLimitUnit): number {
    switch (unit) {
        case "characters":
            return Array.from(text).length;
        case "bytes":
            return utf8.encode(text).length;
    }
}

function offendingIn(text: string, charset: TextCharset | undefined): readonly OffendingCharacter[] {
    if (charset === undefined) return [];
    switch (charset) {
        case "mercadolivre":
            return offendingMessageCharacters(text);
        default:
            return refuseUnhandled(charset, [{ character: text, occurrences: 1 }]);
    }
}

const VISIBLE_CHARACTER = /^[\p{L}\p{N}\p{P}\p{S}]$/u;

function characterLabel(character: string): string {
    if (VISIBLE_CHARACTER.test(character)) return character;
    const code = character.codePointAt(0) ?? 0;
    return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function offendingCharactersLabel(offending: readonly OffendingCharacter[]): string {
    return offending.map((entry) => characterLabel(entry.character)).join(" ");
}

export function textLimitState(text: string, limit: TextLimit | null): TextLimitState | null {
    if (limit === null) return null;
    const count = measure(text, limit.unit);
    const over = count > limit.max;
    const offending = offendingIn(text, limit.charset);
    return {
        count,
        limit: limit.max,
        unit: limit.unit,
        over,
        near: count >= limit.max * NEAR_RATIO,
        refused: over || offending.length > 0,
        offending,
    };
}
