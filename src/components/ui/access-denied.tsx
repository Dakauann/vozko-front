"use client";

import { Info, ShieldWarning } from "@/components/icons";

import { PageNotice } from "@/components/ui/page-notice";
import { useTranslations } from "next-intl";

interface AccessDeniedProps {
  backHref: string;
  featureName?: string;
  requirements?: string[];
  managersOnly?: boolean;
}

function DeniedReason({ featureName, requirements = [], managersOnly }: Omit<AccessDeniedProps, "backHref">) {
  const t = useTranslations("errors.accessDenied");
  if (featureName && managersOnly) {
    return <p className="text-sm leading-relaxed text-muted-foreground">{t("managersOnly", { feature: featureName })}</p>;
  }
  if (featureName && requirements.length > 0) {
    return (
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
        <p>{t("requires", { feature: featureName })}</p>
        <ul className="list-disc space-y-0.5 pl-4 text-foreground">
          {requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </div>
    );
  }
  return <p className="text-sm leading-relaxed text-muted-foreground">{t("hint")}</p>;
}

export function AccessDenied({ backHref, featureName, requirements, managersOnly }: AccessDeniedProps) {
  const t = useTranslations("errors.accessDenied");

  return (
    <PageNotice
      icon={<ShieldWarning className="h-10 w-10" weight="duotone" />}
      color="amber"
      title={t("title")}
      description={t("description")}
      backHref={backHref}
      backLabel={t("goBack")}
    >
      <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-[--radius] border border-border bg-muted px-4 py-3.5 text-left">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" weight="duotone" />
        <DeniedReason featureName={featureName} requirements={requirements} managersOnly={managersOnly} />
      </div>
    </PageNotice>
  );
}
