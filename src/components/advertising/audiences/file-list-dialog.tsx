"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createCustomerListAction } from "@/app/actions/advertising-audiences";
import { isAdsError } from "@/app/actions/advertising";
import { uploadMediaAction } from "@/app/actions/medias";
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
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { FileCsv, UploadSimple, WarningCircle } from "@/components/icons";
import {
  MATCH_KEYS,
  assignColumn,
  hasIdentifyingColumn,
  previewCsv,
  type ColumnMapping,
  type CustomerListResult,
} from "@/lib/advertising/audiences";
import { issuesAt, type ExpectedIssues } from "@/lib/advertising/issues";
import { EMPTY_VALUE } from "@/lib/advertising/money";
import type { AdAccount } from "@/lib/advertising/types";
import { emptyCrmFilter } from "@/lib/crm/board";

import { IssueList } from "../field-issue";
import { HashingNote } from "./hashing-note";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const IGNORE = "ignore";
const UPLOAD_DESCRIPTION = "meta-audience-customer-list";

type Upload = { status: "idle" } | { status: "uploading" } | { status: "done"; mediaId: string } | { status: "error"; message: string };

export function FileListDialog({
  account,
  onClose,
  onCreated,
}: {
  account: AdAccount;
  onClose: () => void;
  onCreated: (result: CustomerListResult) => void;
}) {
  const t = useTranslations("adsAudiences.file");
  const tKeys = useTranslations("adsAudiences.matchKeys");
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadToken = useRef(0);
  const [source, setSource] = useState<{ fileName: string; text: string } | null>(null);
  const [header, setHeader] = useState(false);
  const [columns, setColumns] = useState<ColumnMapping[]>([]);
  const [upload, setUpload] = useState<Upload>({ status: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => (source ? previewCsv(source.text, header) : null), [source, header]);
  const identifying = hasIdentifyingColumn(columns);

  const choose = async (file: File) => {
    setFileError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileError(t("tooLarge"));
      return;
    }
    const text = await file.text();
    const detected = previewCsv(text);
    if (detected.headers.length === 0) {
      setFileError(t("emptyFile"));
      return;
    }
    setSource({ fileName: file.name, text });
    setHeader(detected.hasHeader);
    setColumns(detected.columns);
    setName((current) => current || file.name.replace(/\.[^.]+$/, ""));
    uploadToken.current += 1;
    const token = uploadToken.current;
    setUpload({ status: "uploading" });
    const formData = new FormData();
    formData.append("media", file);
    formData.append("mediaType", "document");
    formData.append("description", UPLOAD_DESCRIPTION);
    const uploaded = await uploadMediaAction(formData);
    if (token !== uploadToken.current) return;
    setUpload(
      uploaded.mediaId && !uploaded.error
        ? { status: "done", mediaId: uploaded.mediaId }
        : { status: "error", message: uploaded.error ?? t("uploadFailed") },
    );
  };

  const submit = async () => {
    if (upload.status !== "done") return;
    setSaving(true);
    setFailure(null);
    const outcome = await createCustomerListAction({
      adAccountId: account.id,
      name: name.trim(),
      description: description.trim() || undefined,
      source: "file",
      fileMediaId: upload.mediaId,
      columns,
      skipHeader: header,
      crmFilter: emptyCrmFilter,
    });
    setSaving(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      setFailure(outcome.expected ? null : outcome.error);
      return;
    }
    onCreated(outcome.data);
  };

  const columnTitle = (index: number) => preview?.headers[index] || t("column", { number: index + 1 });

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-3xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-dashed border-border-strong px-4 py-3">
            <FileCsv className="h-6 w-6 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{source?.fileName ?? t("noFile")}</p>
              <p className="text-xs text-muted-foreground">
                {upload.status === "uploading"
                  ? t("uploading")
                  : upload.status === "done"
                    ? t("uploaded")
                    : upload.status === "error"
                      ? upload.message
                      : t("fileHint")}
              </p>
            </div>
            <Button
              variant="secondary"
              title={source ? t("replace") : t("choose")}
              icon={<UploadSimple className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={() => inputRef.current?.click()}
            />
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void choose(file);
              }}
            />
          </div>
          {fileError ? <p className="text-sm text-destructive-ink">{fileError}</p> : null}
          <IssueList namespace="adsAudiences" issues={issuesAt(expected, "fileMediaId")} />

          {preview ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("mapTitle")}</h3>
                  <p className="text-xs text-muted-foreground">{t("mapHint")}</p>
                </div>
                <ElevatedSwitch checked={header} onCheckedChange={setHeader} label={t("hasHeader")} />
              </div>
              <div className="overflow-x-auto rounded-[--radius] border border-border">
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-muted">
                    <tr>
                      {preview.headers.map((_, index) => (
                        <th key={index} className="min-w-44 border-b border-border-strong px-3 py-2 text-left align-top font-medium">
                          <p className="mb-1.5 truncate text-xs text-muted-foreground">{columnTitle(index)}</p>
                          <ElevatedSelect
                            value={columns[index] || IGNORE}
                            onValueChange={(value) => setColumns((current) => assignColumn(current, index, value === IGNORE ? "" : (value as ColumnMapping)))}
                            aria-label={t("mapColumn", { column: columnTitle(index) })}
                          >
                            <ElevatedSelectItem value={IGNORE}>{t("ignore")}</ElevatedSelectItem>
                            {MATCH_KEYS.map((key) => (
                              <ElevatedSelectItem key={key} value={key}>
                                {tKeys(key)}
                              </ElevatedSelectItem>
                            ))}
                          </ElevatedSelect>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border last:border-0">
                        {preview.headers.map((_, column) => (
                          <td key={column} className="max-w-56 truncate px-3 py-1.5 text-xs text-foreground">
                            {row[column] || EMPTY_VALUE}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!identifying ? (
                <p className="flex items-start gap-1.5 text-xs text-warning-ink">
                  <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("needsIdentifier")}
                </p>
              ) : null}
              <IssueList namespace="adsAudiences" issues={issuesAt(expected, "columns")} />
            </section>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <ElevatedInput label={t("name")} placeholder=" " value={name} onChange={(event) => setName(event.target.value)} />
              <IssueList namespace="adsAudiences" issues={issuesAt(expected, "name")} />
            </div>
            <div className="space-y-1">
              <ElevatedInput
                label={t("descriptionLabel")}
                placeholder=" "
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <IssueList namespace="adsAudiences" issues={issuesAt(expected, "description")} />
            </div>
          </div>

          <HashingNote />
          {failure ? <p className="text-sm text-destructive-ink">{failure}</p> : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} />
          <Button
            variant="primary"
            title={saving ? t("creating") : t("create")}
            onClick={submit}
            disabled={saving || upload.status !== "done" || !identifying}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
