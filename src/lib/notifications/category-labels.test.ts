import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CATEGORY_ICON } from "@/components/notifications/notification-visuals";

import { NOTIFICATION_CATEGORIES } from "./types";

const CATALOGS = { pt, en, es, de } as const;

describe("notification categories", () => {
  it.each(Object.entries(CATALOGS))("are named in %s, so the bell filter and the preferences never show a raw key", (_locale, messages) => {
    const names = messages.notifications.categories as Record<string, string>;
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(names[category]?.trim(), category).toBeTruthy();
    }
  });

  it("each have an icon", () => {
    for (const category of NOTIFICATION_CATEGORIES) expect(CATEGORY_ICON[category], category).toBeDefined();
  });

  it("include the conversations category note mentions publish in", () => {
    expect(NOTIFICATION_CATEGORIES).toContain("conversations");
  });
});
