"use client";

import { useTranslations } from "next-intl";

import { LITERAL_SOURCE, type BindingSource, type VariableBinding } from "@/lib/leads/sends";

export function BindingList({ bindings, labelOf }: { bindings: readonly VariableBinding[]; labelOf: (source: BindingSource) => string }) {
  const t = useTranslations("leadSends.bindings");
  if (bindings.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-sm">
      {bindings.map((binding, index) => (
        <div key={index} className="contents">
          <dt className="readout w-fit rounded-[--radius] bg-muted px-1.5 text-xs font-semibold text-foreground">{`{{${index + 1}}}`}</dt>
          <dd className="min-w-0 truncate">
            {binding.source === LITERAL_SOURCE ? t("literalSummary", { value: (binding.value ?? "").trim() }) : labelOf(binding.source)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SendSummaryLine({ from, departmentName }: { from: string; departmentName: string | null }) {
  const t = useTranslations("leadSends.department");
  return (
    <p className="text-xs text-muted-foreground">
      {from}
      {departmentName ? ` · ${t("value", { name: departmentName })}` : null}
    </p>
  );
}
