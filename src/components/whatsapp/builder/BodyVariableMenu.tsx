"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { checkTemplateVariableNamesAction } from "@/app/actions/whatsapp-templates";
import { useTemplateFields } from "@/components/campaign-audience/use-audience-queries";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { BracketsCurly, MapPin, Plus, Tag, UserCheck, Users } from "@/components/icons";
import { useFieldSourceLabel } from "@/components/leads/sends/send-copy";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BindableField } from "@/lib/campaign-audience/types";
import { LEAD_FIELD_SOURCES } from "@/lib/leads/sends";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { templateErrorMessage } from "@/lib/whatsapp-templates/errors";
import { variableNameTaken } from "@/lib/whatsapp-templates/suggestions";
import { cn } from "@/lib/utils";

const ICON = "h-3.5 w-3.5";

const VARIABLE_NAME_INVALID = "template_variable_name_invalid";

const LEAD_FIELD_ICONS: Record<string, ReactNode> = {
  "lead.first_name": <Users className={ICON} />,
  "lead.name": <Users className={ICON} />,
  "lead.nickname": <Users className={ICON} />,
  "lead.district": <MapPin className={ICON} />,
  "lead.city": <MapPin className={ICON} />,
  "lead.owner_name": <UserCheck className={ICON} />,
};

const ROW = cn(
  "flex w-full items-center gap-2 rounded-[--radius] px-2 py-1.5 text-left text-sm text-foreground transition-colors",
  "hover:bg-[hsl(var(--accent-hover))] focus-visible:bg-[hsl(var(--accent-hover))] focus-visible:outline-none",
);

function isLeadField(source: string): source is keyof typeof LEAD_FIELD_SOURCES {
  return Object.hasOwn(LEAD_FIELD_SOURCES, source);
}

function useFieldExample() {
  const t = useTranslations("whatsappTemplates.form.editor.body.fieldExamples");
  return (field: BindableField): string => (isLeadField(field.source) ? t(LEAD_FIELD_SOURCES[field.source]) : (field.label ?? field.column));
}

type FieldPick = (source: string, example: string, column: string) => void;

export interface FreeVariable {
  slot: number;
  named: boolean;
  text: string;
  onFree: () => void;
  onNamed: (name: string) => void;
}

function useNameRefusalText() {
  const t = useTranslations("whatsappTemplates.form.editor.body.variableMenu");
  const tRoot = useTranslations();
  return (refusal: CodedRefusal, name: string): string => {
    const message = templateErrorMessage(tRoot, refusal.code, refusal.message);
    return refusal.code === VARIABLE_NAME_INVALID ? t("nameRefused", { message, name: refusal.expected?.variable ?? name }) : message;
  };
}

function FreeNameForm({ text, onNamed }: { text: string; onNamed: (name: string) => void }) {
  const t = useTranslations("whatsappTemplates.form.editor.body.variableMenu");
  const refusalText = useNameRefusalText();
  const [name, setName] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const add = async () => {
    const next = name.trim();
    if (variableNameTaken(text, next)) {
      setRefusal(t("nameTaken"));
      return;
    }
    setChecking(true);
    const answer = await checkTemplateVariableNamesAction([next]);
    setChecking(false);
    if (answer.error) {
      setRefusal(refusalText(answer.error, next));
      return;
    }
    setRefusal(null);
    onNamed(next);
  };
  return (
    <div className="grid gap-2 px-2 pb-1.5">
      <ElevatedInput
        controlSize="sm"
        label={t("nameLabel")}
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (!checking) void add();
        }}
      />
      {refusal ? (
        <p role="alert" className="text-xs text-destructive-ink">
          {refusal}
        </p>
      ) : null}
      <Button type="button" variant="secondary" size="sm" title={t("nameAdd")} aria-busy={checking} disabled={checking} onClick={() => void add()} />
      {checking ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("nameChecking")}
        </p>
      ) : null}
    </div>
  );
}

function FieldList({ free, onField }: { free: FreeVariable; onField: FieldPick }) {
  const t = useTranslations("whatsappTemplates.form.editor.body.variableMenu");
  const fields = useTemplateFields();
  const list = fields.data ?? [];
  const labelOf = useFieldSourceLabel(list);
  const exampleOf = useFieldExample();
  const [naming, setNaming] = useState(false);
  return (
    <div className="p-1.5">
      <div role="group" aria-label={t("fieldGroup")} className="py-1">
        <p className="legend px-2 pb-1">{t("fieldGroup")}</p>
        {fields.isPending ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("loading")}</p> : null}
        {fields.isError ? <p className="px-2 py-1.5 text-xs text-destructive-ink">{t("failed")}</p> : null}
        {list.map((field) => (
          <button key={field.source} type="button" className={ROW} onClick={() => onField(field.source, exampleOf(field), field.column)}>
            <span aria-hidden className="flex text-muted-foreground">
              {LEAD_FIELD_ICONS[field.source] ?? <Tag className={ICON} />}
            </span>
            <span className="min-w-0 truncate">{labelOf(field.source)}</span>
          </button>
        ))}
      </div>
      <div aria-hidden className="my-1.5 h-px bg-border" />
      <button type="button" className={cn(ROW, "items-start")} aria-expanded={free.named ? naming : undefined} onClick={() => (free.named ? setNaming(true) : free.onFree())}>
        <span aria-hidden className="mt-0.5 flex text-muted-foreground">
          <BracketsCurly className={ICON} />
        </span>
        <span className="min-w-0">
          <span className="block">{t("free")}</span>
          <span className="block text-xs text-muted-foreground">{free.named ? t("freeNamedHint") : t("freeHint", { slot: `{{${free.slot}}}` })}</span>
        </span>
      </button>
      {free.named && naming ? <FreeNameForm text={free.text} onNamed={free.onNamed} /> : null}
    </div>
  );
}

export function BodyVariableMenu({ label, free, onField }: { label: string; free: FreeVariable; onField: FieldPick }) {
  const [open, setOpen] = useState(false);
  const close = (action: () => void) => {
    action();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-[--radius] px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted"
        >
          <Plus className="h-3 w-3" weight="bold" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
        {open ? (
          <FieldList
            free={{ ...free, onFree: () => close(free.onFree), onNamed: (name) => close(() => free.onNamed(name)) }}
            onField={(source, example, column) => close(() => onField(source, example, column))}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

const CHIP = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[--radius] px-2 py-0.5 text-2xs font-semibold";

function FieldChip({ label }: { label: string }) {
  return (
    <span className={cn(CHIP, "border border-border bg-card text-foreground")}>
      <Users aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}

function CustomFieldChip({ source }: { source: string }) {
  const fields = useTemplateFields();
  const labelOf = useFieldSourceLabel(fields.data ?? []);
  return <FieldChip label={labelOf(source)} />;
}

function LeadFieldChip({ source }: { source: string }) {
  const labelOf = useFieldSourceLabel([]);
  return <FieldChip label={labelOf(source)} />;
}

export function SuggestionChip({ source }: { source?: string }) {
  const t = useTranslations("whatsappTemplates.form.editor.body");
  if (!source) return <span className={cn(CHIP, "border border-dashed border-control-edge text-muted-foreground")}>{t("freeChip")}</span>;
  return isLeadField(source) ? <LeadFieldChip source={source} /> : <CustomFieldChip source={source} />;
}
