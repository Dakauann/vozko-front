import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import deMessages from "@/i18n/messages/de.json";
import type { CodedTranslator } from "@/lib/api/coded-error";
import { SELECTION_ERROR_CODES, selectionErrorMessage } from "./errors";

type Tree = { [key: string]: string | Tree };

function namespaceTranslator(messages: Tree, namespace: string): CodedTranslator {
  const lookup = (key: string): string | undefined => {
    let node: string | Tree | undefined = messages[namespace];
    for (const part of key.split(".")) {
      if (node === undefined || typeof node === "string") return undefined;
      node = node[part];
    }
    return typeof node === "string" ? node : undefined;
  };
  const t = ((key: string) => lookup(key) ?? key) as CodedTranslator;
  t.has = (key: string) => lookup(key) !== undefined;
  return t;
}

const LOCALES: [string, Tree][] = [
  ["pt", ptMessages as unknown as Tree],
  ["en", enMessages as unknown as Tree],
  ["es", esMessages as unknown as Tree],
  ["de", deMessages as unknown as Tree],
];

describe("selectionErrorMessage", () => {
  const t = namespaceTranslator(ptMessages as unknown as Tree, "selection");

  it("translates every selection refusal the backend can answer", () => {
    for (const [locale, messages] of LOCALES) {
      const localized = namespaceTranslator(messages, "selection");
      for (const code of [...SELECTION_ERROR_CODES, "busy", "default"]) {
        expect(localized.has(`errors.${code}`), `${locale}: selection.errors.${code}`).toBe(true);
      }
    }
  });

  it("names the refusal by its code", () => {
    expect(selectionErrorMessage(t, { code: "selection_scope_denied", message: "x", status: 403 })).toBe(
      t("errors.selection_scope_denied"),
    );
  });

  it("reads a busy answer without a code as busy", () => {
    expect(selectionErrorMessage(t, { message: "Bulk selection analytics are busy", status: 503 })).toBe(
      t("errors.busy"),
    );
  });

  it("never shows the raw server text for an unknown refusal", () => {
    expect(selectionErrorMessage(t, { code: "something_new", message: "internal detail", status: 500 })).toBe(
      t("errors.default"),
    );
  });
});
