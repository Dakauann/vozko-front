"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { MemberCommandSelect } from "@/components/members/MemberCommandSelect";
import type { PortfolioHolderScope } from "@/lib/customer-portfolio/portfolio";

const MINE = "__mine__";
const ALL = "__all__";

function scopeValue(scope: PortfolioHolderScope): string {
  switch (scope.kind) {
    case "mine":
      return MINE;
    case "all":
      return ALL;
    case "member":
      return scope.userId;
  }
}

function scopeOf(value: string): PortfolioHolderScope {
  if (value === MINE) return { kind: "mine" };
  if (value === ALL) return { kind: "all" };
  return { kind: "member", userId: value };
}

export function PortfolioScopeSelect({ scope, userId, onChange }: { scope: PortfolioHolderScope; userId: string; onChange: (scope: PortfolioHolderScope) => void }) {
  const t = useTranslations("customerPortfolio");
  const leading = useMemo(
    () => [
      { value: MINE, label: t("scope.mine") },
      { value: ALL, label: t("scope.all") },
    ],
    [t],
  );
  const excluded = useMemo(() => [userId], [userId]);
  const value = scopeValue(scope);

  return (
    <MemberCommandSelect
      value={scope.kind === "member" ? scope.userId : ""}
      selectedValue={value}
      onChange={(picked) => onChange(scopeOf(picked))}
      text={{ label: t("scope.label"), search: t("member.search"), empty: t("member.empty"), failed: t("member.failed") }}
      leadingOptions={leading}
      excluded={excluded}
    />
  );
}
