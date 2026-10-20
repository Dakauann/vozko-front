"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AttentionControls } from "@/components/attention/attention-controls";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { CaretLeft } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useNotificationActions, useNotificationPreferences } from "@/hooks/use-notifications";
import { isBusySectionError, sectionErrorCode } from "@/lib/analytics/section-query";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { NotificationCategory, NotificationPreferenceChoice, NotificationPreferences } from "@/lib/notifications/types";

import { CATEGORY_ICON } from "./notification-visuals";

function withEmail(preferences: NotificationPreferences, category: NotificationCategory, email: boolean): NotificationCategory[] {
  const others = preferences.emailMuted.filter((muted) => muted !== category);
  return email ? others : [...others, category];
}

type DeliveryMode = "immediate" | "digest";

function useSaveChoice(preferences: NotificationPreferences) {
  const t = useTranslations("notifications");
  const { savePreferences } = useNotificationActions();
  return (change: Partial<NotificationPreferenceChoice>) => {
    void savePreferences({ emailMuted: preferences.emailMuted, emailDigest: preferences.emailDigest, ...change }).then((error) => {
      if (error) toast.error(codedErrorMessage(t, error, t("preferences.saveFailed")));
    });
  };
}

function DeliveryChoice({ preferences }: { preferences: NotificationPreferences }) {
  const t = useTranslations("notifications");
  const save = useSaveChoice(preferences);
  const mode: DeliveryMode = preferences.emailDigest ? "digest" : "immediate";

  return (
    <div className="space-y-2 border-b border-border px-4 pb-3">
      <div className="flex items-center gap-1.5">
        <p className="legend">{t("preferences.delivery")}</p>
        <ExplainerHint id="settings.notificationDigest" />
      </div>
      <ElevatedPillToggle<DeliveryMode>
        size="md"
        aria-label={t("preferences.delivery")}
        value={mode}
        onChange={(next) => save({ emailDigest: next === "digest" })}
        options={[
          { value: "immediate", label: t("preferences.deliveryImmediate") },
          { value: "digest", label: t("preferences.deliveryDigest") },
        ]}
        className="grid w-full grid-cols-2"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {mode === "digest" ? t("preferences.deliveryDigestHint") : t("preferences.deliveryImmediateHint")}
      </p>
    </div>
  );
}

function CategoryRows({ preferences }: { preferences: NotificationPreferences }) {
  const t = useTranslations("notifications");
  const save = useSaveChoice(preferences);

  const change = (category: NotificationCategory, email: boolean) => save({ emailMuted: withEmail(preferences, category, email) });

  return (
    <ul aria-label={t("preferences.categoriesLegend")} className="divide-y divide-border">
      {preferences.categories.map((category) => {
        const Glyph = CATEGORY_ICON[category];
        const name = t(`categories.${category}`);
        return (
          <li key={category} className="flex items-center gap-3 px-4 py-2.5">
            <span aria-hidden className="tile-neutral flex h-7 w-7 shrink-0 items-center justify-center">
              <Glyph className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
            <ElevatedSwitch
              aria-label={t("preferences.emailFor", { category: name })}
              checked={!preferences.emailMuted.includes(category)}
              onCheckedChange={(email) => change(category, email)}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function NotificationPreferencesView({ onBack }: { onBack: () => void }) {
  const t = useTranslations("notifications");
  const preferences = useNotificationPreferences(true);

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border py-2.5 pl-2 pr-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("preferences.back")}
          title={t("preferences.back")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CaretLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{t("preferences.title")}</h2>
        <ExplainerHint id="settings.notificationEmail" align="end" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section aria-label={t("preferences.deviceLegend")} className="space-y-2 border-b border-border px-4 py-3">
          <p className="legend">{t("preferences.deviceLegend")}</p>
          <AttentionControls />
        </section>
        <div className="space-y-3 px-4 pb-2 pt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("preferences.description")}</p>
          <Notice tone="info">
            <p>{t("preferences.critical")}</p>
          </Notice>
        </div>
        {preferences.isPending ? (
          <ScreenLoader fit="fill" className="min-h-40" />
        ) : preferences.data ? (
          <>
            <DeliveryChoice preferences={preferences.data} />
            <p className="legend px-4 pb-1 pt-3">{t("preferences.categoriesLegend")}</p>
            <CategoryRows preferences={preferences.data} />
          </>
        ) : (
          <div className="p-4">
            <SectionError
              busy={isBusySectionError(preferences.error)}
              retrying={preferences.isFetching}
              onRetry={() => void preferences.refetch()}
              message={codedErrorMessage(t, { code: sectionErrorCode(preferences.error) }, t("preferences.loadFailed"))}
            />
          </div>
        )}
      </div>
    </>
  );
}
