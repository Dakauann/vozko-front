import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";

import { ExplainerHint } from "../ExplainerHint";
import { explainerIds, explainerSpec } from "./index";
import { requiredTexts } from "./required-texts";

const LOCALES = { pt: ptMessages, en: enMessages, es: esMessages, de: deMessages } as const;

function lookup(messages: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), messages);
}

function registeredTextIds(messages: { explainers: Record<string, unknown> }): string[] {
  return Object.entries(messages.explainers)
    .filter(([, value]) => typeof value === "object")
    .flatMap(([area, entries]) => Object.keys(entries as object).map((key) => `${area}.${key}`));
}

describe("explainer catalog", () => {
  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`has every text in ${locale}, written without dashes`, () => {
      for (const id of explainerIds()) {
        for (const key of requiredTexts(id)) {
          const value = lookup(messages, `explainers.${id}.${key}`);
          expect(typeof value === "string" && value.trim().length > 0, `${locale} explainers.${id}.${key}`).toBe(true);
          expect(/[\u2013\u2014]/.test(value as string), `${locale} explainers.${id}.${key} has a dash`).toBe(false);
        }
      }
    });

    it(`has no texts for unregistered explainers in ${locale}`, () => {
      expect(registeredTextIds(messages).sort()).toEqual([...explainerIds()].sort());
    });
  }

  it.each(explainerIds())("opens %s with its scene and steps", (id) => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <ExplainerHint id={id} />
      </NextIntlClientProvider>,
    );
    const name = lookup(ptMessages, `explainers.${id}.name`) as string;

    fireEvent.click(screen.getByRole("button", { name: `Saiba mais sobre ${name}` }));

    const card = screen.getByRole("dialog", { name });
    expect(card.querySelector('[role="img"]')).not.toBeNull();
    expect(card.querySelectorAll("li").length).toBeGreaterThanOrEqual(explainerSpec(id).steps);
  });
});
