"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowSquareOut, CircleNotch, Key } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { screenPaths } from "@/lib/navigation/routes";
import { secretTemplateGroup, secretUsageSnippets } from "@/lib/workflow-secrets/secret-name";
import { useWorkflowSecretNames } from "@/lib/workflow-secrets/use-workflow-secret-names";

interface VarGroup {
  label: string;
  description?: string;
  vars: { template: string; description: string }[];
}

export function useSecretVarGroups<T extends VarGroup>(availableVars: T[]): Array<T | VarGroup> {
  const { names } = useWorkflowSecretNames();
  return useMemo(() => {
    const group = secretTemplateGroup(names);
    return group ? [...availableVars, group] : availableVars;
  }, [availableVars, names]);
}

export function SecretsManageLink() {
  const t = useTranslations("workflowsPage.secretPicker");
  return (
    <a
      href={screenPaths.workflow_secrets}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-[--radius] text-2xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Key size={12} weight="bold" />
      {t("manage")}
      <ArrowSquareOut size={10} />
    </a>
  );
}

export function SecretCodeMenu({ onInsert }: { onInsert: (text: string) => void }) {
  const t = useTranslations("workflowsPage.secretPicker");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Key size={12} weight="bold" />
          {t("insert")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[200] w-[280px] p-0">
        {open && (
          <SecretList
            onPick={(name) => {
              onInsert(secretUsageSnippets(name).code);
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function SecretList({ onPick }: { onPick: (name: string) => void }) {
  const t = useTranslations("workflowsPage.secretPicker");
  const { names, loading, failed } = useWorkflowSecretNames();
  return (
    <div>
      <div className="max-h-60 overflow-y-auto py-1">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 text-2xs text-muted-foreground">
            <CircleNotch size={12} className="animate-spin" />
          </div>
        )}
        {!loading && failed && <p className="px-3 py-2 text-2xs text-destructive-ink">{t("loadFailed")}</p>}
        {!loading && !failed && names.length === 0 && <p className="px-3 py-2 text-2xs text-muted-foreground">{t("empty")}</p>}
        {names.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <span className="text-xs font-medium text-foreground">{name}</span>
            <code className="text-2xs text-muted-foreground">{secretUsageSnippets(name).code}</code>
          </button>
        ))}
      </div>
      <div className="border-t border-border px-3 py-2">
        <SecretsManageLink />
      </div>
    </div>
  );
}
