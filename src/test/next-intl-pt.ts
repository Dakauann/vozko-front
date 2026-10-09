import { vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

type NextIntl = typeof import("next-intl");
type Translator = ReturnType<NextIntl["createTranslator"]>;

export async function nextIntlInPortuguese(): Promise<NextIntl> {
  const actual = await vi.importActual<NextIntl>("next-intl");
  const translators = new Map<string, Translator>();
  const useTranslations = (namespace?: string): Translator => {
    const key = namespace ?? "";
    const known = translators.get(key);
    if (known) return known;
    const created = actual.createTranslator({ locale: "pt", messages: ptMessages, namespace } as never) as Translator;
    translators.set(key, created);
    return created;
  };
  return { ...actual, useTranslations: useTranslations as NextIntl["useTranslations"] };
}
