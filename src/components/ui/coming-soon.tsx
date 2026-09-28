"use client";

import { useTranslations } from "next-intl";

import { Hourglass } from "@/components/icons";
import { PageNotice } from "@/components/ui/page-notice";

export function ComingSoon({ backHref }: { backHref: string }) {
  const t = useTranslations("errors.upcoming");
  return (
    <PageNotice
      icon={<Hourglass className="h-10 w-10" weight="duotone" />}
      color="primary"
      title={t("title")}
      description={t("description")}
      backHref={backHref}
      backLabel={t("goBack")}
    />
  );
}
