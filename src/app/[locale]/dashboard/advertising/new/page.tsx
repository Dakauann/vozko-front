import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { newRouteTarget } from "@/lib/advertising/editor-entry";

export default async function NewAdPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getLocale();
  const raw = await searchParams;
  const params = new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])));
  redirect({ href: newRouteTarget(params), locale });
}
