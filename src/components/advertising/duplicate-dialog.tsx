"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { copyAdObjectAction, isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { CheckRow } from "@/components/advertising/wizard/choice-row";
import { issuesAt, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdRow } from "@/lib/advertising/types";

import { IssueList } from "./field-issue";

const SAME_PARENT = "same";

function DuplicateForm({
  row,
  parents,
  onClose,
  onDone,
}: {
  row: AdRow;
  parents: AdRow[];
  onClose: () => void;
  onDone: (row: AdRow, metaId: string) => void;
}) {
  const t = useTranslations("adsManager.duplicate");
  const [deepCopy, setDeepCopy] = useState(row.level !== "ad");
  const [suffix, setSuffix] = useState(() => t("defaultSuffix"));
  const [parentId, setParentId] = useState(SAME_PARENT);
  const [saving, setSaving] = useState(false);
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setSaving(true);
    setError(null);
    setExpected({});
    void copyAdObjectAction(row.metaId, {
      deepCopy: row.level !== "ad" && deepCopy,
      nameSuffix: suffix,
      parentId: parentId === SAME_PARENT ? undefined : parentId,
    }).then((result) => {
      setSaving(false);
      if (isAdsError(result)) {
        setExpected(result.expected ?? {});
        setError(result.expected ? null : result.error);
        return;
      }
      onDone(row, result.data.metaId);
    });
  };

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t(`title.${row.level}`)}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("description", { name: row.name })}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <div className="space-y-4">
        {row.level !== "ad" ? (
          <CheckRow checked={deepCopy} onChange={setDeepCopy} title={t(`deepCopy.${row.level}`)} hint={t("deepCopyHint")} />
        ) : null}
        <div className="space-y-1.5">
          <ElevatedInput label={t("suffix")} value={suffix} onChange={(event) => setSuffix(event.target.value)} controlSize="sm" maxLength={60} />
          <p className="text-xs text-muted-foreground">{t("suffixPreview", { name: `${row.name}${suffix}` })}</p>
          <IssueList namespace="adsManager" issues={issuesAt(expected, "nameSuffix")} />
        </div>
        {row.level !== "campaign" ? (
          <div className="space-y-1.5">
            <ElevatedSelect label={t(`parent.${row.level}`)} value={parentId} onValueChange={setParentId}>
              <ElevatedSelectItem value={SAME_PARENT}>{t("sameParent")}</ElevatedSelectItem>
              {parents.map((parent) => (
                <ElevatedSelectItem key={parent.metaId} value={parent.metaId}>
                  {parent.name}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <IssueList namespace="adsManager" issues={issuesAt(expected, "parentId")} />
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive-ink" role="alert">{error}</p> : null}
      </div>
      <ElevatedDialogFooter>
        <Button variant="ghost" size="sm" title={t("cancel")} onClick={onClose} disabled={saving} />
        <Button variant="primary" size="sm" title={saving ? t("saving") : t("submit")} onClick={submit} disabled={saving} />
      </ElevatedDialogFooter>
    </>
  );
}

export function DuplicateDialog({
  row,
  parents,
  onClose,
  onDone,
}: {
  row: AdRow | null;
  parents: AdRow[];
  onClose: () => void;
  onDone: (row: AdRow, metaId: string) => void;
}) {
  return (
    <ElevatedDialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent>
        {row ? <DuplicateForm key={row.metaId} row={row} parents={parents} onClose={onClose} onDone={onDone} /> : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
