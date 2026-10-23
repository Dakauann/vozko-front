"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ArrowDown, ArrowUp, Plus, Trash } from "@/components/icons";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/lib/format/local-datetime";
import { RCS_BUTTON_ACTIONS, buttonActionOf, newSuggestion, suggestionWithAction, type RcsButtonAction } from "@/lib/rcs/buttons";
import { moveItem, removeItem, replaceItem } from "@/lib/rcs/content-edit";
import { cardPath, suggestionPath } from "@/lib/rcs/issues";
import { RCS_LIMITS } from "@/lib/rcs/limits";
import type { RcsCalendarEvent, RcsSuggestion } from "@/lib/rcs/types";

import { ActionGlyph } from "../preview/SuggestionGlyph";
import { useComposer, useFieldIssue } from "./composer-context";
import { RcsTextField } from "./RcsTextField";

function localValue(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : toLocalDateTimeInput(date);
}

function isoValue(local: string): string {
  return fromLocalDateTimeInput(local)?.toISOString() ?? "";
}

function coordinate(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ActionFields({ suggestion, onChange }: { suggestion: RcsSuggestion; onChange: (next: RcsSuggestion) => void }) {
  const t = useTranslations("rcs.composer.button");
  const { variables, disabled } = useComposer();
  const action = buttonActionOf(suggestion);

  if (action === "reply") return <p className="text-xs text-muted-foreground sm:col-span-2">{t("hints.reply")}</p>;

  if (action === "open_url" || action === "webview") {
    return (
      <RcsTextField
        className="sm:col-span-2"
        label={t("url")}
        type="url"
        inputMode="url"
        placeholder="https://"
        value={suggestion.url ?? ""}
        onChange={(url) => onChange({ ...suggestion, url })}
        hint={t(`hints.${action}`)}
        variables={variables}
        disabled={disabled}
      />
    );
  }

  if (action === "dial") {
    return (
      <RcsTextField
        className="sm:col-span-2"
        label={t("phone")}
        type="tel"
        inputMode="tel"
        placeholder="+55 11 99999 0000"
        value={suggestion.phone ?? ""}
        onChange={(phone) => onChange({ ...suggestion, phone })}
        hint={t("hints.dial")}
        disabled={disabled}
      />
    );
  }

  if (action === "view_location") {
    return (
      <>
        <ElevatedInput
          label={t("latitude")}
          type="number"
          step="any"
          inputMode="decimal"
          value={suggestion.latitude ?? ""}
          onChange={(event) => onChange({ ...suggestion, latitude: coordinate(event.target.value) })}
          disabled={disabled}
        />
        <ElevatedInput
          label={t("longitude")}
          type="number"
          step="any"
          inputMode="decimal"
          value={suggestion.longitude ?? ""}
          onChange={(event) => onChange({ ...suggestion, longitude: coordinate(event.target.value) })}
          disabled={disabled}
        />
        <RcsTextField
          className="sm:col-span-2"
          label={t("locationLabel")}
          value={suggestion.location_label ?? ""}
          onChange={(location_label) => onChange({ ...suggestion, location_label })}
          hint={t("hints.view_location")}
          disabled={disabled}
        />
      </>
    );
  }

  const event: RcsCalendarEvent = suggestion.calendar ?? { title: "", starts_at: "", ends_at: "" };
  const setEvent = (patch: Partial<RcsCalendarEvent>) => onChange({ ...suggestion, calendar: { ...event, ...patch } });
  return (
    <>
      <RcsTextField
        className="sm:col-span-2"
        label={t("eventTitle")}
        value={event.title}
        onChange={(title) => setEvent({ title })}
        disabled={disabled}
      />
      <ElevatedInput
        label={t("startsAt")}
        type="datetime-local"
        value={localValue(event.starts_at)}
        onChange={(change) => setEvent({ starts_at: isoValue(change.target.value) })}
        disabled={disabled}
      />
      <ElevatedInput
        label={t("endsAt")}
        type="datetime-local"
        value={localValue(event.ends_at)}
        onChange={(change) => setEvent({ ends_at: isoValue(change.target.value) })}
        disabled={disabled}
      />
      <RcsTextField
        className="sm:col-span-2"
        label={t("eventDescription")}
        value={event.description ?? ""}
        onChange={(description) => setEvent({ description })}
        hint={t("hints.calendar")}
        disabled={disabled}
      />
    </>
  );
}

function ButtonEditor({
  suggestion,
  index,
  count,
  card,
  onChange,
  onMove,
  onRemove,
}: {
  suggestion: RcsSuggestion;
  index: number;
  count: number;
  card: number;
  onChange: (next: RcsSuggestion) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("rcs.composer.button");
  const { variables, disabled } = useComposer();
  const issue = useFieldIssue();
  const path = suggestionPath(card, index);
  const action = buttonActionOf(suggestion);
  const ownIssue = issue(path);

  return (
    <li className="overflow-hidden rounded-[--radius] border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-1.5">
        <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md border border-control-edge bg-card text-foreground">
          <ActionGlyph action={action} className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{t("heading", { index: index + 1, action: t(`actions.${action}`) })}</p>
        <Button variant="ghost" size="icon" aria-label={t("moveUp")} icon={<ArrowUp className="h-3.5 w-3.5" />} iconVisible disabled={disabled || index === 0} onClick={() => onMove(index - 1)} />
        <Button variant="ghost" size="icon" aria-label={t("moveDown")} icon={<ArrowDown className="h-3.5 w-3.5" />} iconVisible disabled={disabled || index === count - 1} onClick={() => onMove(index + 1)} />
        <Button variant="ghost" size="icon" aria-label={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} iconVisible disabled={disabled} onClick={onRemove} />
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <ElevatedSelect
          label={t("action")}
          aria-label={t("action")}
          value={action}
          onValueChange={(next) => onChange(suggestionWithAction(suggestion, next as RcsButtonAction))}
          disabled={disabled}
          contentClassName="z-[210]"
        >
          {RCS_BUTTON_ACTIONS.map((option) => (
            <ElevatedSelectItem key={option} value={option}>
              <span className="inline-flex items-center gap-2">
                <ActionGlyph action={option} className="h-3.5 w-3.5 text-muted-foreground" />
                {t(`actions.${option}`)}
              </span>
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <RcsTextField
          label={t("label")}
          value={suggestion.label}
          onChange={(label) => onChange({ ...suggestion, label })}
          max={RCS_LIMITS.maxSuggestionLabelRunes}
          variables={variables}
          disabled={disabled}
        />
        <ActionFields suggestion={suggestion} onChange={onChange} />
      </div>
      {ownIssue ? <p className="border-t border-border px-3 py-2 text-xs font-medium text-destructive-ink">{ownIssue}</p> : null}
    </li>
  );
}

export function ButtonListEditor({
  suggestions,
  onChange,
  card,
  max,
  title,
  hint,
}: {
  suggestions: readonly RcsSuggestion[];
  onChange: (next: RcsSuggestion[]) => void;
  card: number;
  max: number;
  title: string;
  hint: string;
}) {
  const t = useTranslations("rcs.composer.button");
  const { disabled } = useComposer();
  const issue = useFieldIssue();
  const listIssue = card >= 0 ? issue(cardPath(card, "suggestions")) : undefined;
  const full = suggestions.length >= max;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="readout text-2xs tabular-nums text-muted-foreground">{t("count", { count: suggestions.length, max })}</span>
      </div>
      {listIssue ? <p className="text-xs font-medium text-destructive-ink">{listIssue}</p> : null}
      {suggestions.length > 0 ? (
        <ol className="space-y-2.5">
          {suggestions.map((suggestion, index) => (
            <ButtonEditor
              key={index}
              suggestion={suggestion}
              index={index}
              count={suggestions.length}
              card={card}
              onChange={(next) => onChange(replaceItem(suggestions, index, next))}
              onMove={(to) => onChange(moveItem(suggestions, index, to))}
              onRemove={() => onChange(removeItem(suggestions, index))}
            />
          ))}
        </ol>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        title={t("add")}
        icon={<Plus className="h-3.5 w-3.5" />}
        iconVisible
        iconSide="left"
        disabled={disabled || full}
        onClick={() => onChange([...suggestions, newSuggestion(t("defaultLabel"))])}
      />
    </div>
  );
}
