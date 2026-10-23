"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Prohibit, SlidersHorizontal } from "@/components/icons";
import { usePathname, useRouter } from "@/i18n/routing";

import { CarrierSuppressionsPage } from "../suppressions/CarrierSuppressionsPage";
import { CarrierSettingsPage } from "./CarrierSettingsPage";
import { CarrierAreaGate } from "@/components/carrier-messaging/shared/ComingSoon";

type RulesTab = "rules" | "suppressions";

const TAB_PARAM = "tab";

function tabOf(value: string | null): RulesTab {
  return value === "suppressions" ? "suppressions" : "rules";
}

function CarrierRulesScreenBody() {
  const t = useTranslations("carrierMessaging.pages.campaignHost.rulesTabs");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = tabOf(params.get(TAB_PARAM));

  const choose = (next: RulesTab) => router.replace(next === "rules" ? pathname : `${pathname}?${TAB_PARAM}=${next}`, { scroll: false });

  const toggle = (
    <ElevatedPillToggle<RulesTab>
      size="md"
      aria-label={t("label")}
      value={tab}
      onChange={choose}
      options={[
        { value: "rules", label: t("rules"), icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
        { value: "suppressions", label: t("suppressions"), icon: <Prohibit className="h-3.5 w-3.5" /> },
      ]}
    />
  );

  return tab === "suppressions" ? <CarrierSuppressionsPage headerActions={toggle} /> : <CarrierSettingsPage headerActions={toggle} />;
}

export function CarrierRulesScreen() {
  const t = useTranslations("carrierMessaging.pages.settings");
  return (
    <CarrierAreaGate badge={t("header.badge")} description={t("header.description")}>
      <CarrierRulesScreenBody />
    </CarrierAreaGate>
  );
}
