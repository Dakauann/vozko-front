"use client";

import { useTranslations } from "next-intl";

import ElevatedDatePicker from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import {
  ClipboardText,
  DeviceMobile,
  Eye,
  Globe,
  InstagramLogo,
  MessengerLogo,
  Package,
  ThumbsUp,
  WhatsappLogo,
  type Icon,
} from "@/components/icons";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  MAX_NAME,
  campaignBudgetActive,
  effectiveBudgetKind,
  scheduleAvailable,
  withDestination,
  withGoal,
  type StartMode,
} from "@/lib/advertising/draft";
import type { AdDraftDestination, AdOptimizationGoal } from "@/lib/advertising/draft-types";
import { goalsFor, isMessaging, routesFor } from "@/lib/advertising/wizard-routes";

import { AudienceSection } from "./audience-section";
import { BudgetFields } from "./budget-fields";
import { ChoiceRow, Hint, Section } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { IdentityFields } from "./identity-fields";
import { PlacementsSection } from "./placements-section";
import { PromotionFields, hasPromotionFields } from "./promotion-fields";
import { ReachEstimate } from "./reach-estimate";
import { ScheduleGrid } from "./schedule-grid";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

const DESTINATION_ICONS: Record<AdDraftDestination, Icon> = {
  WHATSAPP: WhatsappLogo,
  MESSENGER: MessengerLogo,
  INSTAGRAM_DIRECT: InstagramLogo,
  WEBSITE: Globe,
  ON_AD: ClipboardText,
  APP: DeviceMobile,
  ON_POST: ThumbsUp,
  CATALOG: Package,
  NONE: Eye,
};

function dayDate(day: string | null): Date | undefined {
  return day ? new Date(`${day}T00:00:00`) : undefined;
}

export function pageDependent(destination: AdDraftDestination | ""): boolean {
  return isMessaging(destination) || destination === "ON_AD" || destination === "ON_POST";
}

function ScheduleSection() {
  const t = useTranslations("adsWizard.schedule");
  const { form, patch, account, today, issues } = useWizard();
  const lifetime = effectiveBudgetKind(form) === "LIFETIME";
  const hours = scheduleAvailable(form);

  return (
    <Section title={t("title")} description={t("description", { timezone: account?.timezone ?? "" })}>
      <RadioGroup
        value={form.startMode}
        onValueChange={(value) => patch({ startMode: value as StartMode })}
        className="grid gap-2 sm:grid-cols-2"
      >
        <ChoiceRow value="now" title={t("startNow")} hint={t("startNowHint")} />
        <ChoiceRow value="date" title={t("startLater")} />
      </RadioGroup>
      <div className="grid gap-3 sm:grid-cols-2">
        {form.startMode === "date" ? (
          <ElevatedDatePicker
            id="ad-start-day"
            label={t("startDay")}
            value={form.startDay}
            minDate={dayDate(today)}
            onChange={(startDay) => patch({ startDay })}
          />
        ) : null}
        <ElevatedDatePicker
          id="ad-end-day"
          label={lifetime ? t("endDayRequired") : t("endDay")}
          value={form.endDay}
          minDate={dayDate(form.startMode === "date" && form.startDay ? form.startDay : today)}
          onChange={(endDay) => patch({ endDay })}
        />
      </div>
      <Hint>{lifetime ? t("endLifetimeHint") : t("endHint")}</Hint>
      <FieldIssues issues={issues} field="adSet.startAt" />
      <FieldIssues issues={issues} field="adSet.endAt" />
      {hours ? (
        <div className="space-y-2">
          <ElevatedSwitch
            checked={form.scheduleOn}
            onCheckedChange={(scheduleOn) => patch({ scheduleOn })}
            label={t("hoursOn")}
            description={t("hoursHint")}
          />
          {form.scheduleOn ? <ScheduleGrid value={form.schedule} onChange={(schedule) => patch({ schedule })} /> : null}
        </div>
      ) : (
        <Hint>{t("hoursNeedLifetime")}</Hint>
      )}
      <FieldIssues issues={issues} field="adSet.schedule" nested />
    </Section>
  );
}

export function AdSetStep() {
  const t = useTranslations("adsWizard.adSet");
  const labels = useWizardLabels();
  const { form, patch, update, account, options, issues } = useWizard();
  const routes = routesFor(options, form.objective);
  const goals = goalsFor(routes, form.destination);
  const onCampaign = campaignBudgetActive(form);

  return (
    <div className="space-y-6">
      <Section title={t("nameTitle")}>
        <ElevatedInput
          label={t("name")}
          value={form.adSetName}
          maxLength={MAX_NAME}
          placeholder=" "
          onChange={(event) => patch({ adSetName: event.target.value })}
        />
        <Hint>{t("nameHint")}</Hint>
        <FieldIssues issues={issues} field="adSet.name" />
      </Section>

      <Section title={t("destinationTitle")} description={t("destinationDescription")}>
        {routes.length === 0 ? <p className="text-sm text-muted-foreground">{t("noRoutes")}</p> : null}
        <RadioGroup
          value={form.destination}
          onValueChange={(value) => update((current) => withDestination(current, value as AdDraftDestination, routes))}
          className="grid gap-2 sm:grid-cols-2"
        >
          {routes.map((route) => {
            const DestinationIcon = DESTINATION_ICONS[route.destination] ?? Globe;
            return (
              <ChoiceRow
                key={route.destination}
                value={route.destination}
                title={labels.destination(route.destination)}
                hint={t.has(`destinations.${route.destination}.body`) ? t(`destinations.${route.destination}.body`) : undefined}
                icon={<DestinationIcon className="h-4 w-4" />}
              />
            );
          })}
        </RadioGroup>
        {goals.length > 0 ? (
          <ElevatedSelect
            label={t("goal")}
            value={form.goal}
            onValueChange={(value) => update((current) => withGoal(current, value as AdOptimizationGoal))}
          >
            {goals.map((goal) => (
              <ElevatedSelectItem key={goal} value={goal}>
                {labels.goal(goal)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        ) : null}
        {form.goal && t.has(`goalHints.${form.goal}`) ? <Hint>{t(`goalHints.${form.goal}`)}</Hint> : null}
        <FieldIssues issues={issues} field="adSet.destination" />
        <FieldIssues issues={issues} field="adSet.goal" />
      </Section>

      {pageDependent(form.destination) ? (
        <Section title={t("identityTitle")} description={t("identityDescription")}>
          <IdentityFields instagramRequired={form.destination === "INSTAGRAM_DIRECT"} />
        </Section>
      ) : null}

      {hasPromotionFields(form.destination, form.goal) ? (
        <Section title={t("promotionTitle")} description={t("promotionDescription")}>
          <PromotionFields />
        </Section>
      ) : null}

      <Section title={t("budgetTitle")} description={onCampaign ? undefined : t("budgetDescription")}>
        {onCampaign ? (
          <Hint>{t("budgetOnCampaign")}</Hint>
        ) : (
          <BudgetFields
            level="adSet"
            budget={form.adSetBudget}
            bid={form.adSetBid}
            goal={form.goal}
            currency={account?.currency ?? ""}
            issues={issues}
            onBudget={(adSetBudget) => patch({ adSetBudget })}
            onBid={(adSetBid) => patch({ adSetBid })}
          />
        )}
      </Section>

      <ScheduleSection />

      <ReachEstimate />
      <AudienceSection />

      <Section title={t("placementsTitle")} description={t("placementsDescription")}>
        <PlacementsSection />
      </Section>
    </div>
  );
}
