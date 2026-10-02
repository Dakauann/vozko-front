"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createAdTestAction, isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedDatePicker from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { DEFAULT_TEST_CONFIDENCE, TEST_CONFIDENCES, cellsFor, sharesTotal, testWindow } from "@/lib/advertising/ab-test";
import { addDays, civilToday } from "@/lib/advertising/date-range";
import { issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount, AdRow, AdTestCell, AdTestLevel } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { IssueList } from "./field-issue";

const DEFAULT_DAYS = 7;

function dayDate(day: string): Date | undefined {
  return day ? new Date(`${day}T00:00:00`) : undefined;
}

function AbTestForm({
  level,
  objects,
  account,
  onClose,
  onCreated,
}: {
  level: AdTestLevel;
  objects: AdRow[];
  account: AdAccount;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const t = useTranslations("adsManager.abTest");
  const [now] = useState(() => new Date());
  const today = civilToday(account.timezone, now) ?? "";
  const [name, setName] = useState("");
  const [cells, setCells] = useState<AdTestCell[]>(() => cellsFor(objects));
  const [startDay, setStartDay] = useState(today);
  const [endDay, setEndDay] = useState(() => (today ? addDays(today, DEFAULT_DAYS - 1) : ""));
  const [confidence, setConfidence] = useState(DEFAULT_TEST_CONFIDENCE);
  const [saving, setSaving] = useState(false);
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [error, setError] = useState<string | null>(null);

  const total = sharesTotal(cells);
  const span = testWindow(startDay, endDay, today, account.timezone, now);
  const windowProblem = "problem" in span ? span.problem : null;
  const ready = name.trim() !== "" && total === 100 && cells.every((cell) => cell.share > 0 && cell.name.trim() !== "") && !windowProblem;

  const setCell = (index: number, changes: Partial<AdTestCell>) =>
    setCells((current) => current.map((cell, position) => (position === index ? { ...cell, ...changes } : cell)));

  const submit = () => {
    const chosen = testWindow(startDay, endDay, today, account.timezone, new Date());
    if ("problem" in chosen) return;
    setSaving(true);
    setError(null);
    setExpected({});
    void createAdTestAction({
      adAccountId: account.id,
      name: name.trim(),
      level,
      cells: cells.map((cell) => ({ ...cell, name: cell.name.trim() })),
      startAt: chosen.startAt,
      endAt: chosen.endAt,
      confidence,
    }).then((result) => {
      setSaving(false);
      if (isAdsError(result)) {
        setExpected(result.expected ?? {});
        setError(result.expected ? t("fixIssues") : result.error);
        return;
      }
      onCreated(name.trim());
    });
  };

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t(`description.${level}`, { count: objects.length })}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <ElevatedDialogBody className="space-y-4">
        <div className="space-y-1.5">
          <ElevatedInput label={t("name")} value={name} maxLength={400} onChange={(event) => setName(event.target.value)} controlSize="sm" />
          <IssueList namespace="adsManager" issues={issuesUnder(expected, "name")} />
        </div>

        <fieldset className="space-y-2">
          <legend className="legend">{t("cells")}</legend>
          {cells.map((cell, index) => (
            <div key={cell.objectIds.join(",")} className="grid grid-cols-[minmax(0,1fr)_6rem] items-end gap-2">
              <ElevatedInput
                label={t("cellName", { index: index + 1 })}
                value={cell.name}
                maxLength={400}
                onChange={(event) => setCell(index, { name: event.target.value })}
                controlSize="sm"
              />
              <ElevatedInput
                label={t("share")}
                inputMode="numeric"
                value={String(cell.share)}
                onChange={(event) => setCell(index, { share: Number(event.target.value.replace(/\D/g, "")) || 0 })}
                controlSize="sm"
              />
            </div>
          ))}
          <p className={cn("text-xs tabular-nums", total === 100 ? "text-muted-foreground" : "text-destructive-ink")}>
            {t("sharesTotal", { total })}
          </p>
          <IssueList namespace="adsManager" issues={issuesUnder(expected, "cells")} />
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <ElevatedDatePicker id="ads-test-start" label={t("start")} value={startDay} minDate={dayDate(today)} onChange={setStartDay} />
          <ElevatedDatePicker id="ads-test-end" label={t("end")} value={endDay} minDate={dayDate(startDay || today)} onChange={setEndDay} />
        </div>
        {windowProblem ? <p className="text-xs text-destructive-ink">{t(`window.${windowProblem}`)}</p> : null}
        <p className="text-xs text-muted-foreground">{t("timezone", { timezone: account.timezone })}</p>
        <IssueList namespace="adsManager" issues={[...issuesUnder(expected, "startAt"), ...issuesUnder(expected, "endAt")]} />

        <ElevatedSelect label={t("confidence")} value={String(confidence)} onValueChange={(value) => setConfidence(Number(value))}>
          {TEST_CONFIDENCES.map((option) => (
            <ElevatedSelectItem key={option} value={String(option)}>
              {t("confidenceOption", { value: option })}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <p className="text-xs text-muted-foreground">{t("confidenceHint")}</p>
        {error ? <p className="text-sm text-destructive-ink" role="alert">{error}</p> : null}
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button variant="ghost" size="sm" title={t("cancel")} onClick={onClose} disabled={saving} />
        <Button variant="primary" size="sm" title={saving ? t("saving") : t("submit")} onClick={submit} disabled={saving || !ready} />
      </ElevatedDialogFooter>
    </>
  );
}

export function AbTestDialog({
  open,
  level,
  objects,
  account,
  onClose,
  onCreated,
}: {
  open: boolean;
  level: AdTestLevel;
  objects: AdRow[];
  account: AdAccount;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  return (
    <ElevatedDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <ElevatedDialogContent className="max-w-xl">
        {open ? <AbTestForm level={level} objects={objects} account={account} onClose={onClose} onCreated={onCreated} /> : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
