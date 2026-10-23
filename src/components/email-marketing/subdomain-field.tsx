"use client";

import { useTranslations } from "next-intl";

import { useEmailError } from "@/components/email-marketing/use-email-error";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { StatusChip } from "@/components/elevated-design/status-chip";
import type { SubdomainCheckState } from "@/hooks/use-email-marketing";

export function subdomainReady(state: SubdomainCheckState): boolean {
  return !state.checking && state.check?.available === true;
}

export function SubdomainField({ value, onChange, state }: { value: string; onChange: (value: string) => void; state: SubdomainCheckState }) {
  const t = useTranslations("emailMarketing.subdomain");
  const describe = useEmailError();
  const refusal = state.error ? describe(state.error) : state.check && !state.check.available ? describe({ code: state.check.error_code }) : undefined;
  const address = state.check?.address;

  return (
    <div className="space-y-2">
      <ElevatedInput
        label={t("label")}
        placeholder=" "
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        error={refusal}
      />
      <p className="text-xs text-muted-foreground">{t("help")}</p>
      <div aria-live="polite" className="flex min-h-6 flex-wrap items-center gap-2 text-xs">
        {state.checking ? (
          <span className="text-muted-foreground">{t("checking")}</span>
        ) : (
          <>
            {state.check?.available ? <StatusChip tone="healthy" label={t("available")} /> : null}
            {address ? <span className="break-all text-foreground">{t("preview", { address })}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
