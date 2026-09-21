import { redirect } from "@/i18n/routing";
import { getLocale } from "next-intl/server";

export default async function StageGroupsPage() {
  const locale = await getLocale();
  redirect({ href: "/dashboard/funnels", locale });
}
