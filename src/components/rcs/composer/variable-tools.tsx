"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

import { BracketsCurly, Plus } from "@/components/icons";
import { useBindingLabel } from "@/components/leads/sends/send-copy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { LITERAL_SOURCE, bindingChoices, type BindingChoice, type BindingSource, type VariableBinding } from "@/lib/leads/sends";
import { slotForSource } from "@/lib/rcs/variables";

export interface VariableTools {
  choices: readonly BindingChoice[];
  fieldChoices: readonly BindingChoice[];
  bindings: readonly VariableBinding[];
  labelOf: (source: BindingSource) => string;
  addSource: (source: BindingSource) => number;
  setBinding: (index: number, binding: VariableBinding) => void;
}

export function useVariableTools(bindings: readonly VariableBinding[], onBindingsChange: (bindings: VariableBinding[]) => void): VariableTools {
  const fields = useLeadFieldDefinitions().definitions;
  const choices = useMemo(() => bindingChoices(fields), [fields]);
  const fieldChoices = useMemo(() => choices.filter((choice) => choice.source !== LITERAL_SOURCE), [choices]);
  const labelOf = useBindingLabel(choices);
  const addSource = useCallback(
    (source: BindingSource) => {
      const next = slotForSource(bindings, source);
      if (next.bindings.length !== bindings.length) onBindingsChange(next.bindings);
      return next.slot;
    },
    [bindings, onBindingsChange],
  );
  const setBinding = useCallback(
    (index: number, binding: VariableBinding) => onBindingsChange(bindings.map((item, at) => (at === index ? binding : item))),
    [bindings, onBindingsChange],
  );
  return { choices, fieldChoices, bindings, labelOf, addSource, setBinding };
}

const BUILT_IN_CHIPS = 6;

export function VariableChipRow({ tools, onInsert, disabled }: { tools: VariableTools; onInsert: (source: BindingSource) => void; disabled?: boolean }) {
  const t = useTranslations("carrierMessaging.variables");
  const shown = tools.fieldChoices.slice(0, BUILT_IN_CHIPS);
  const more = tools.fieldChoices.slice(BUILT_IN_CHIPS);
  return (
    <div role="group" aria-label={t("label")} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-2xs font-semibold text-muted-foreground">{t("label")}</span>
      {shown.map((choice) => (
        <button
          key={choice.source}
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(choice.source)}
          aria-label={t("insert", { field: tools.labelOf(choice.source) })}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-control-edge bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Plus aria-hidden className="h-3 w-3 text-muted-foreground" weight="bold" />
          {tools.labelOf(choice.source)}
        </button>
      ))}
      {more.length > 0 ? <VariableMenu tools={tools} onInsert={onInsert} choices={more} disabled={disabled} label={t("more")} /> : null}
    </div>
  );
}

export function VariableMenu({
  tools,
  onInsert,
  choices = tools.fieldChoices,
  label,
  disabled,
}: {
  tools: VariableTools;
  onInsert: (source: BindingSource) => void;
  choices?: readonly BindingChoice[];
  label?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("carrierMessaging.variables");
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          className="inline-flex h-7 items-center gap-1 rounded-[--radius] px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <BracketsCurly aria-hidden className="h-3.5 w-3.5" />
          {label ?? t("menu")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[210] max-h-72 w-56 overflow-y-auto" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuLabel className="text-2xs text-muted-foreground">{t("hint")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {choices.map((choice) => (
          <DropdownMenuItem key={choice.source} onSelect={() => onInsert(choice.source)}>
            {tools.labelOf(choice.source)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
