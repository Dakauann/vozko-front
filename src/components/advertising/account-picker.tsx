"use client";

import { useTranslations } from "next-intl";

import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import type { AdAccount } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

export function AccountPicker({
  accounts,
  value,
  onChange,
  disabled,
  className,
}: {
  accounts: AdAccount[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("adsManager.account");
  return (
    <div className={cn("w-72 max-w-full", className)}>
      <ElevatedSelect value={value ?? undefined} onValueChange={onChange} disabled={disabled} aria-label={t("label")}>
        {accounts.map((account) => (
          <ElevatedSelectItem key={account.id} value={account.id}>
            {account.name} · {account.currency}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
    </div>
  );
}
