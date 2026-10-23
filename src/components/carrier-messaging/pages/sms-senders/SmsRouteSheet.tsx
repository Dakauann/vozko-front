"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { createSmsRouteAction, setSmsRouteInboxAction, updateSmsRouteAction } from "@/app/actions/sms";
import { CarrierInboxSettingsPanel } from "@/components/carrier-messaging/shared/CarrierInboxSettings";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { CircleNotch, Lock } from "@/components/icons";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { SMS_LIMITS } from "@/lib/sms/limits";
import type { CarrierInboxSettings } from "@/lib/carrier-messaging/types";
import type { SmsRoute } from "@/lib/sms/types";

function RouteAutomation({ route, onUpdated }: { route: SmsRoute; onUpdated: (route: SmsRoute) => void }) {
  const t = useTranslations("carrierMessaging.pages.smsSenders.sheet");
  const [current, setCurrent] = useState(route);
  const save = useCallback((settings: CarrierInboxSettings) => setSmsRouteInboxAction(route.id, settings), [route.id]);
  const saved = useCallback(
    (settings: CarrierInboxSettings) => {
      const next = { ...current, ...settings };
      setCurrent(next);
      onUpdated(next);
    },
    [current, onUpdated],
  );
  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div>
        <p className="text-sm font-semibold text-foreground">{t("automationTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("automationDescription")}</p>
      </div>
      <CarrierInboxSettingsPanel ownerId={route.id} settings={current} save={save} onSaved={saved} controlId="sms-route-inbox" />
    </div>
  );
}

function RouteForm({
  route,
  onSaved,
  onUpdated,
  onCancel,
}: {
  route: SmsRoute | null;
  onSaved: (route: SmsRoute) => void;
  onUpdated: (route: SmsRoute) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("carrierMessaging.pages.smsSenders.sheet");
  const refusalText = useCarrierRefusalText();
  const [prefix, setPrefix] = useState(route?.brand_prefix ?? "");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);
  const shown = prefix.trim() || t("prefixSample");

  const save = async () => {
    setBusy(true);
    const input = { brand_prefix: prefix };
    const answer = route ? await updateSmsRouteAction(route.id, input) : await createSmsRouteAction(input);
    setBusy(false);
    if (answer.error) {
      setRefusal(answer.error);
      return;
    }
    onSaved(answer.data);
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-4">
        <div className="space-y-1.5">
          <ElevatedInput
            label={t("prefix")}
            value={prefix}
            maxLength={SMS_LIMITS.maxBrandPrefixRunes}
            onChange={(event) => setPrefix(event.target.value)}
            error={refusal ? refusalText(refusal) : undefined}
            disabled={busy}
            autoFocus
          />
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t("prefixHint", { min: SMS_LIMITS.minBrandPrefixRunes, max: SMS_LIMITS.maxBrandPrefixRunes })}</p>
            <span className="readout shrink-0 text-2xs tabular-nums text-muted-foreground">
              {t("counter", { count: Array.from(prefix).length, max: SMS_LIMITS.maxBrandPrefixRunes })}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="legend">{t("previewTitle")}</p>
          <div className="rounded-[--radius] border border-border bg-card p-4">
            <p className="w-fit max-w-full rounded-[18px] rounded-bl-[6px] bg-muted px-3.5 py-2 text-sm text-foreground">
              <span className="font-semibold">{t("previewPrefix", { prefix: shown })}</span> {t("previewBody")}
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock aria-hidden className="h-3 w-3" />
            {t("previewHint")}
          </p>
        </div>
        {route ? <RouteAutomation route={route} onUpdated={onUpdated} /> : null}
      </div>
      <ElevatedSheetFooter className="flex-row justify-end border-t border-border">
        <Button variant="ghost" title={t("cancel")} onClick={onCancel} disabled={busy} />
        <Button type="submit" title={route ? t("save") : t("create")} icon={busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : undefined} iconVisible={busy} disabled={busy} />
      </ElevatedSheetFooter>
    </form>
  );
}

export function SmsRouteSheet({
  open,
  route,
  onOpenChange,
  onSaved,
  onUpdated = () => undefined,
}: {
  open: boolean;
  route: SmsRoute | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (route: SmsRoute) => void;
  onUpdated?: (route: SmsRoute) => void;
}) {
  const t = useTranslations("carrierMessaging.pages.smsSenders.sheet");
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className={route ? "flex w-full flex-col gap-0 sm:max-w-lg" : "flex w-full flex-col gap-0 sm:max-w-md"}>
        <ElevatedSheetHeader className="space-y-1 border-b border-border pr-16">
          <ElevatedSheetTitle className="text-xl">{route ? t("editTitle") : t("createTitle")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("description")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        {open ? <RouteForm key={route?.id ?? "new"} route={route} onSaved={onSaved} onUpdated={onUpdated} onCancel={() => onOpenChange(false)} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
