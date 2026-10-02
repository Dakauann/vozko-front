"use client";

import { useTranslations } from "next-intl";

import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { manageBlockerKey } from "@/lib/advertising/delivery";
import type { AdAccount } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

export function AccountPicker({
  accounts,
  value,
  onChange,
  disabled,
  blockerOf,
  className,
}: {
  accounts: AdAccount[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  blockerOf?: (account: AdAccount) => string | null;
  className?: string;
}) {
  const t = useTranslations("adsManager.account");
  const tReasons = useTranslations("adsAccounts.reasons");
  return (
    <div className={cn("w-72 max-w-full", className)}>
      <ElevatedSelect value={value ?? undefined} onValueChange={onChange} disabled={disabled} aria-label={t("label")}>
        {accounts.map((account) => {
          const blocker = blockerOf?.(account) ?? null;
          const badge = blocker ? tReasons(blocker) : manageBlockerKey(account) === "readOnly" ? t("readOnly") : null;
          return (
            <ElevatedSelectItem key={account.id} value={account.id} disabled={!!blocker}>
              {account.name} · {account.currency}
              {badge ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">{badge}</span> : null}
            </ElevatedSelectItem>
          );
        })}
      </ElevatedSelect>
    </div>
  );
}
