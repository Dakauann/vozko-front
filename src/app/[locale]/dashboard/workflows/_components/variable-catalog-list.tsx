"use client";

import { useMemo, useState, type Ref } from "react";
import { useTranslations } from "next-intl";

import { CircleNotch, MagnifyingGlass } from "@/components/icons";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  searchVariables,
  variableBadges,
  variableGroupsOf,
  variableTemplate,
  type CatalogVariable,
  type VariableBadge,
} from "@/lib/workflows/variable-catalog";

import type { NodeVariables } from "./variable-catalog-context";

const BADGE_CHIP = "inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-2xs text-muted-foreground";

function BadgeChip({ badge }: { badge: VariableBadge }) {
  const t = useTranslations("workflowsPage.variablePicker.badges");
  switch (badge.kind) {
    case "default":
      return <span className={BADGE_CHIP}>{t("default")}</span>;
    case "some_paths":
      return (
        <span className={BADGE_CHIP}>
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
          {t("somePaths")}
        </span>
      );
    case "source":
      return <span className={BADGE_CHIP}>{t("source", { node: badge.nodeName })}</span>;
  }
}

function VariableRow({ item }: { item: CatalogVariable }) {
  const t = useTranslations("workflowsPage.variablePicker");
  const badges = variableBadges(item);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-foreground">{item.label}</span>
        <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{t(`types.${item.type}`)}</span>
      </span>
      <code className="truncate font-mono text-2xs text-muted-foreground">{variableTemplate(item.ref)}</code>
      {(badges.length > 0 || item.example) && (
        <span className="flex flex-wrap items-center gap-1">
          {badges.map((badge) => (
            <BadgeChip key={badge.kind} badge={badge} />
          ))}
          {item.example && <span className="min-w-0 truncate text-2xs text-muted-foreground">{t("example", { example: item.example })}</span>}
        </span>
      )}
    </div>
  );
}

export function VariableCatalogList({
  variables,
  onPick,
  searchRef,
}: {
  variables: NodeVariables;
  onPick: (template: string) => void;
  searchRef?: Ref<HTMLInputElement>;
}) {
  const t = useTranslations("workflowsPage.variablePicker");
  const tWorkflows = useTranslations("workflowsPage");
  const [search, setSearch] = useState("");
  const { state, retry } = variables;
  const all = state.status === "ready" ? state.catalog.variables : null;
  const groups = useMemo(() => (all ? variableGroupsOf(searchVariables(all, search)) : []), [all, search]);

  if (state.status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 px-3 py-3 text-2xs text-muted-foreground">
        <CircleNotch size={12} className="animate-spin motion-reduce:animate-none" aria-hidden />
        {t("loading")}
      </p>
    );
  }
  if (state.status === "unavailable") return <p className="px-3 py-3 text-2xs text-muted-foreground">{t("unavailable")}</p>;
  if (state.status === "failed") {
    return (
      <div role="alert" className="space-y-1.5 px-3 py-3">
        <p className="flex items-start gap-1.5 text-2xs text-foreground">
          <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
          {codedErrorMessage(tWorkflows, { code: state.code }, t("failed"))}
        </p>
        <button
          type="button"
          onClick={retry}
          className="text-2xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  const { unreadable } = state.catalog;
  return (
    <Command shouldFilter={false} className="rounded-lg">
      <div className="border-b px-3 py-2.5">
        <ElevatedInput
          ref={searchRef}
          aria-label={t("search")}
          placeholder={t("search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          controlSize="sm"
          icon={<MagnifyingGlass size={14} />}
        />
      </div>
      <CommandList className="max-h-[320px] overflow-y-auto">
        {all && all.length === 0 && <p className="px-3 py-3 text-2xs text-muted-foreground">{t("none")}</p>}
        {all && all.length > 0 && groups.length === 0 && <p className="px-3 py-3 text-2xs text-muted-foreground">{t("noMatch")}</p>}
        {groups.map((group) => (
          <CommandGroup
            key={group.group}
            heading={
              <span className="flex items-center gap-2 px-1 py-1">
                <span className="text-2xs font-semibold text-muted-foreground">{t(`groups.${group.group}`)}</span>
                <span className="ml-auto text-2xs text-muted-foreground">{group.variables.length}</span>
              </span>
            }
            className="pb-2"
          >
            {group.variables.map((item) => (
              <CommandItem
                key={item.ref}
                value={item.ref}
                onSelect={() => onPick(variableTemplate(item.ref))}
                className="mx-1 flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2"
              >
                <VariableRow item={item} />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {unreadable > 0 && <p className="px-3 py-2 text-2xs text-muted-foreground">{t("unreadable", { count: unreadable })}</p>}
      </CommandList>
    </Command>
  );
}
