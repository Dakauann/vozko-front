"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { Copy, Plus, Trash } from "@/components/icons";
import { RcsComposer } from "@/components/rcs/composer/RcsComposer";
import type { RcsMediaPicker } from "@/components/rcs/composer/composer-context";
import type { RcsPreviewAgent } from "@/components/rcs/preview/palette";
import { SmsComposer } from "@/components/sms/SmsComposer";
import { CAMPAIGN_LIMITS, type CampaignDraft } from "@/lib/carrier-messaging/campaigns";
import type { SmsRoute } from "@/lib/sms/types";

import { addVariant, canAddVariant, duplicateVariant, removeVariant, updateVariant } from "./editor-state";

export function MessageStep({
  draft,
  onChange,
  agent,
  route,
  onPickMedia,
}: {
  draft: CampaignDraft;
  onChange: (draft: CampaignDraft) => void;
  agent: RcsPreviewAgent;
  route: SmsRoute | null;
  onPickMedia?: RcsMediaPicker;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.message");
  const [chosen, setChosen] = useState(0);
  const active = Math.min(chosen, draft.variants.length - 1);
  const variant = draft.variants[active];
  const testing = draft.variants.length > 1;
  const set = (next: CampaignDraft, focus: number) => {
    onChange(next);
    setChosen(focus);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-border bg-card px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{testing ? t("abTitle", { count: draft.variants.length }) : t("singleTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("abHint", { max: CAMPAIGN_LIMITS.maxVariants })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {testing ? (
            <ElevatedPillToggle<string>
              aria-label={t("variantsLabel")}
              value={String(active)}
              onChange={(next) => setChosen(Number(next))}
              options={draft.variants.map((item, index) => ({ value: String(index), label: item.name.trim() || t("variantFallback", { index: index + 1 }) }))}
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            title={testing ? t("addVariant") : t("startTest")}
            icon={<Plus className="h-3.5 w-3.5" />}
            iconVisible
            iconSide="left"
            disabled={!canAddVariant(draft)}
            onClick={() => set(addVariant(draft), draft.variants.length)}
          />
        </div>
      </div>

      {testing ? (
        <div className="flex flex-wrap items-end gap-2">
          <ElevatedInput
            label={t("variantName")}
            value={variant.name}
            onChange={(event) => onChange(updateVariant(draft, active, { ...variant, name: event.target.value }))}
            className="max-w-xs"
          />
          <Button variant="ghost" size="sm" title={t("duplicate")} icon={<Copy className="h-3.5 w-3.5" />} iconVisible iconSide="left" disabled={!canAddVariant(draft)} onClick={() => set(duplicateVariant(draft, active), active + 1)} />
          <Button variant="ghost" size="sm" title={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} iconVisible iconSide="left" onClick={() => set(removeVariant(draft, active), Math.max(active - 1, 0))} />
        </div>
      ) : null}

      {draft.channel === "rcs" ? (
        <RcsComposer
          key={`rcs-${active}-${draft.variants.length}`}
          value={variant.content ?? {}}
          onChange={(content) => onChange(updateVariant(draft, active, { ...variant, content }))}
          bindings={variant.bindings}
          onBindingsChange={(bindings) => onChange(updateVariant(draft, active, { ...variant, bindings }))}
          agent={agent}
          onPickMedia={onPickMedia}
        />
      ) : (
        <SmsComposer
          key={`sms-${active}-${draft.variants.length}`}
          value={variant.text ?? ""}
          onChange={(text) => onChange(updateVariant(draft, active, { ...variant, text }))}
          bindings={variant.bindings}
          onBindingsChange={(bindings) => onChange(updateVariant(draft, active, { ...variant, bindings }))}
          brandPrefix={route?.brand_prefix}
          routeId={route?.id}
          sender={route?.kind === "dedicated" ? route.number : undefined}
        />
      )}
    </div>
  );
}
