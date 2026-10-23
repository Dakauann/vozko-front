"use client";

import { useEffect } from "react";
import { useTimeZone } from "next-intl";
import { useRouter } from "next/navigation";

import { TIME_ZONE_COOKIE } from "@/i18n/time-zone";
import { browserTimezone } from "@/lib/working-hours/types";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function TimeZoneSync() {
  const rendered = useTimeZone();
  const router = useRouter();

  useEffect(() => {
    const browser = browserTimezone();
    if (browser === rendered) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(browser)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    router.refresh();
  }, [rendered, router]);

  return null;
}
