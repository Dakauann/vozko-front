"use client";

import * as React from "react";
import { Plus, Trash, Warning } from "@/components/icons";
import { useTranslations } from "next-intl";

import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  WORKING_HOURS_DAY_ORDER,
  WORKING_HOURS_TIMEZONES,
  WORKING_HOURS_WEEKDAYS,
  browserTimezone,
  defaultWorkingHours,
  validateWorkingHours,
  type WorkingHoursDay,
  type WorkingHoursIssue,
  type WorkingHoursSpec,
} from "@/lib/working-hours/types";
import { cn } from "@/lib/utils";

type WorkingHoursEditorProps = {
  /** null = sem horário configurado, que significa operação 24h. */
  value: WorkingHoursSpec | null;
  onChange: (next: WorkingHoursSpec | null) => void;
  disabled?: boolean;
  /** Texto do estado desligado — difere entre workspace e departamento. */
  offHint: string;
};

/**
 * Editor de escala semanal, usado tanto pelo workspace quanto pelo
 * departamento.
 *
 * Controlado de propósito: quem salva é o card que o contém, porque os dois
 * lugares salvam por rotas diferentes. O que este componente garante é que o
 * documento entregue ao pai já passou pelas mesmas regras do servidor.
 */
export function WorkingHoursEditor({
  value,
  onChange,
  disabled,
  offHint,
}: WorkingHoursEditorProps) {
  const t = useTranslations("workingHours");
  const issues = value ? validateWorkingHours(value) : [];

  const handleToggle = (on: boolean) => {
    onChange(on ? defaultWorkingHours(browserTimezone()) : null);
  };

  const patchDay = (day: WorkingHoursDay, windows: WorkingHoursSpec["days"][WorkingHoursDay]) => {
    if (!value) return;
    const days = { ...value.days };
    if (!windows || windows.length === 0) {
      delete days[day];
    } else {
      days[day] = windows;
    }
    onChange({ ...value, days });
  };

  const globalIssue = issues.find(
    (i) => i.kind === "noOpenTime" || i.kind === "noTimezone",
  );

  return (
    <div className="space-y-4 rounded-[--radius] border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">{t("enableLabel")}</p>
          <p className="text-xs text-muted-foreground">
            {value ? t("enableHint") : offHint}
          </p>
        </div>
        <Switch
          checked={!!value}
          onCheckedChange={handleToggle}
          disabled={disabled}
          aria-label={t("enableLabel")}
        />
      </div>

      {value ? (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              {t("timezoneLabel")}
            </span>
            <ElevatedSelect
              value={value.timezone}
              onValueChange={(tz) => onChange({ ...value, timezone: tz })}
              disabled={disabled}
              placeholder={t("timezoneLabel")}
            >
              {timezoneOptions(value.timezone).map((tz) => (
                <ElevatedSelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <span className="mt-1 block text-2xs text-muted-foreground">
              {t("timezoneHint")}
            </span>
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{t("weekLabel")}</p>
            {/*
              Preencher sete dias um a um é o trabalho chato desta tela, e a
              escala real quase sempre repete de segunda a sexta. O atalho copia
              o primeiro dia útil aberto para os outros quatro.
            */}
            <button
              type="button"
              disabled={disabled || !firstOpenWeekday(value)}
              onClick={() => onChange(applyToWeekdays(value))}
              className="rounded-[--radius] px-2 py-1 text-xs font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("applyToWeekdays")}
            </button>
          </div>

          <div className="space-y-1.5">
            {WORKING_HOURS_DAY_ORDER.map((day) => (
              <DayRow
                key={day}
                day={day}
                windows={value.days[day] ?? []}
                issues={issues}
                disabled={disabled}
                onChange={(windows) => patchDay(day, windows)}
              />
            ))}
          </div>

          {globalIssue ? (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {globalIssue.kind === "noTimezone"
                  ? t("errors.noTimezone")
                  : t("errors.noOpenTime")}
              </span>
            </p>
          ) : null}

          <p className="text-2xs text-muted-foreground">{t("overnightHint")}</p>
        </>
      ) : null}
    </div>
  );
}

/** O primeiro dia útil que já tem faixas — a origem da cópia. */
function firstOpenWeekday(spec: WorkingHoursSpec): WorkingHoursDay | null {
  return (
    WORKING_HOURS_WEEKDAYS.find((day) => (spec.days[day] ?? []).length > 0) ?? null
  );
}

/**
 * Copia o primeiro dia útil aberto para segunda a sexta.
 *
 * Sábado e domingo ficam intocados de propósito: quem abre no fim de semana
 * costuma abrir em horário diferente, e sobrescrever isso silenciosamente
 * apagaria a exceção que a pessoa acabou de configurar.
 */
function applyToWeekdays(spec: WorkingHoursSpec): WorkingHoursSpec {
  const source = firstOpenWeekday(spec);
  if (!source) return spec;
  const template = spec.days[source] ?? [];
  const days = { ...spec.days };
  for (const day of WORKING_HOURS_WEEKDAYS) {
    days[day] = template.map((w) => ({ ...w }));
  }
  return { ...spec, days };
}

/**
 * Garante que a zona já salva apareça na lista mesmo que não esteja na curadoria
 * — caso contrário abrir a tela mostraria um campo vazio e salvar trocaria a
 * escala de fuso sem ninguém pedir.
 */
function timezoneOptions(current: string): string[] {
  if (!current || WORKING_HOURS_TIMEZONES.includes(current)) {
    return [...WORKING_HOURS_TIMEZONES];
  }
  return [current, ...WORKING_HOURS_TIMEZONES];
}

type DayRowProps = {
  day: WorkingHoursDay;
  windows: { start: string; end: string }[];
  issues: WorkingHoursIssue[];
  disabled?: boolean;
  onChange: (windows: { start: string; end: string }[]) => void;
};

function DayRow({ day, windows, issues, disabled, onChange }: DayRowProps) {
  const t = useTranslations("workingHours");
  const open = windows.length > 0;

  const issueFor = (index: number) =>
    issues.find(
      (i) =>
        (i.kind === "badTime" || i.kind === "emptyWindow" || i.kind === "overlap") &&
        i.day === day &&
        i.index === index,
    );

  // Um dia fechado não ganha lavagem cinza. `bg-muted/30` era um fundo com
  // alfa — muda de cor conforme a superfície embaixo, que é justamente o que a
  // receita de fundo opaco existe para evitar — e ainda competia com o cinza
  // sólido que os chips usam para dizer "desligado". O switch desligado e a
  // palavra "Fechado" comunicam o estado sem pintar nada.
  return (
    <div className="rounded-[--radius] border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Switch
          checked={open}
          disabled={disabled}
          onCheckedChange={(on) =>
            onChange(on ? [{ start: "09:00", end: "18:00" }] : [])
          }
          aria-label={t(`days.${day}`)}
        />
        <span className="w-24 shrink-0 text-sm font-medium text-foreground">
          {t(`days.${day}`)}
        </span>
        {!open ? (
          <span className="text-xs text-muted-foreground">{t("closed")}</span>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2.5 space-y-2 pl-[3.25rem]">
          {windows.map((window, index) => {
            const issue = issueFor(index);
            return (
              <div key={index} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TimeField
                    value={window.start}
                    invalid={!!issue}
                    disabled={disabled}
                    aria-label={t("startLabel")}
                    onChange={(next) =>
                      onChange(
                        windows.map((w, i) =>
                          i === index ? { ...w, start: next } : w,
                        ),
                      )
                    }
                  />
                  <span className="text-xs text-muted-foreground">{t("to")}</span>
                  <TimeField
                    value={window.end}
                    invalid={!!issue}
                    disabled={disabled}
                    aria-label={t("endLabel")}
                    onChange={(next) =>
                      onChange(
                        windows.map((w, i) =>
                          i === index ? { ...w, end: next } : w,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(windows.filter((_, i) => i !== index))}
                    aria-label={t("removeWindow")}
                    className="rounded-[--radius] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
                {issue ? (
                  <p className="text-2xs text-destructive">
                    {issue.kind === "badTime"
                      ? t("errors.badTime")
                      : issue.kind === "emptyWindow"
                        ? t("errors.emptyWindow")
                        : t("errors.overlap")}
                  </p>
                ) : null}
              </div>
            );
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([...windows, { start: "13:00", end: "18:00" }])}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[--radius] px-1 py-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addWindow")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * `value` e `onChange` são omitidos dos props nativos de propósito: o nativo
 * entrega um evento e este campo entrega a string já pronta, e deixar as duas
 * assinaturas se cruzarem faz o tipo virar algo que nenhum chamador satisfaz.
 */
function TimeField({
  value,
  onChange,
  invalid,
  disabled,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      {...rest}
      type="time"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-28 rounded-[--radius] border bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed",
        invalid ? "border-destructive" : "border-border",
      )}
    />
  );
}
