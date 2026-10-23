"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { ChatText, WhatsappLogo, type Icon } from "@/components/icons";
import { ComingSoonPanel } from "@/components/carrier-messaging/shared/ComingSoon";
import { SmsComposer } from "@/components/sms/SmsComposer";
import type { SmsTextCheckState } from "@/components/sms/use-sms-text-check";
import type { VariableBinding } from "@/lib/leads/sends";

function Step({ number, icon: Glyph, title, description, children }: { number: number; icon: Icon; title: string; description: string; children: ReactNode }) {
  return (
    <li className="group/steps relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
      <span aria-hidden className="absolute bottom-1 left-4 top-9 w-px bg-border-strong group-last/steps:hidden" />
      <span aria-hidden className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border border-control-edge bg-card text-foreground">
        <Glyph className="h-4 w-4" />
      </span>
      <div className="min-w-0 space-y-3 pb-6 group-last/steps:pb-0">
        <div>
          <p className="text-sm font-semibold text-foreground">
            <span className="readout mr-1.5 text-muted-foreground">{number}</span>
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </li>
  );
}

export function FallbackFields({
  smsText,
  onSmsTextChange,
  bindings,
  onBindingsChange,
  whatsappTemplateSlot,
  smsRouteSlot,
  smsRouteId,
  smsBrandPrefix,
  smsCheck,
  smsComingSoon = false,
  disabled = false,
}: {
  smsText: string;
  onSmsTextChange: (text: string) => void;
  bindings: VariableBinding[];
  onBindingsChange: (bindings: VariableBinding[]) => void;
  whatsappTemplateSlot?: ReactNode;
  smsRouteSlot?: ReactNode;
  smsRouteId?: string;
  smsBrandPrefix?: string;
  smsCheck?: SmsTextCheckState;
  smsComingSoon?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("rcs.fallback");
  return (
    <PanelSection title={t("title")} description={t("description")}>
      <ol className="space-y-0">
        <Step number={1} icon={WhatsappLogo} title={t("whatsapp.title")} description={t("whatsapp.description")}>
          {whatsappTemplateSlot ?? <p className="rounded-[--radius] border border-dashed border-control-edge px-3 py-3 text-xs text-muted-foreground">{t("whatsapp.empty")}</p>}
        </Step>
        <Step number={2} icon={ChatText} title={t("sms.title")} description={t("sms.description")}>
          {smsComingSoon ? (
            <ComingSoonPanel variant="sms" compact />
          ) : (
            <SmsComposer
              compact
              value={smsText}
              onChange={onSmsTextChange}
              bindings={bindings}
              onBindingsChange={onBindingsChange}
              routeSlot={smsRouteSlot}
              routeId={smsRouteId}
              brandPrefix={smsBrandPrefix}
              check={smsCheck}
              disabled={disabled}
            />
          )}
        </Step>
      </ol>
    </PanelSection>
  );
}
