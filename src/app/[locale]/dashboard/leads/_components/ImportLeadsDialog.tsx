"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { CheckCircle, DownloadSimple, UploadSimple, Users } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import {
  importLeadsAction,
  LEAD_IMPORT_MAX_ROWS,
  type LeadImportResult,
} from "@/app/actions/leads";
import { downloadLeadImportTemplate } from "@/lib/leads/template";
import { readDelimitedFile } from "@/lib/csv/parse";
import {
  buildLeadImportRows,
  countRowsWithoutName,
  MAX_SEEDED_CONVERSATIONS,
  readLeadImportFile,
  type LeadColumnMap,
  type LeadImportFile,
} from "@/lib/leads/import";
import {
  MessageVariantsEditor,
  placeholdersIn,
  variantsAgree,
} from "@/components/unofficial-whatsapp/message-variants-editor";
import {
  CampaignMediaPicker,
  MEDIA_ACCEPT,
} from "@/components/campaigns/CampaignMediaPicker";
import { cn } from "@/lib/utils";

const REJECTED_PREVIEW = 15;

const NO_COLUMN = "none";

const MAX_SEED_VARIANTS = 10;

const SEED_MESSAGE_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

const NAME_PLACEHOLDER = 1;

const SEED_CONTEXT_MAX = 600;

const SEED_MEDIA_KINDS = ["image", "video", "audio", "document", "sticker"] as const;

type SeedMediaKind = (typeof SEED_MEDIA_KINDS)[number];

export function ImportLeadsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const t = useTranslations("leadsPage.import");
  const { toast } = useToast();
  const { can } = useWorkspace();
  const { user } = useAuth();
  const isSystemAdmin = user?.role === "admin";
  const canSeedInbox = can("unofficial_whatsapp_instances", "send");
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<LeadImportFile | null>(null);
  const [map, setMap] = useState<LeadColumnMap>({ number: 0, name: 1, age: null });
  const [onExisting, setOnExisting] = useState<"fill_empty" | "skip">("fill_empty");
  const [seedInbox, setSeedInbox] = useState(false);
  const [seedConversations, setSeedConversations] = useState(false);
  const [bodies, setBodies] = useState<string[]>([""]);
  const [seedContext, setSeedContext] = useState("");
  const [mediaKind, setMediaKind] = useState<SeedMediaKind>("image");
  const [mediaId, setMediaId] = useState<string | undefined>(undefined);
  const [mediaName, setMediaName] = useState<string | undefined>(undefined);
  const [maxMessages, setMaxMessages] = useState(4);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<LeadImportResult | null>(null);

  const parsed = useMemo(
    () => (file ? buildLeadImportRows(file, map) : null),
    [file, map],
  );

  const tooManyRows = (parsed?.rows.length ?? 0) > LEAD_IMPORT_MAX_ROWS;

  const canScript = isSystemAdmin && canSeedInbox && seedInbox;
  const trimmedBodies = bodies.map((b) => b.trim()).filter(Boolean);
  const scriptIsValid =
    trimmedBodies.length > 0 && variantsAgree(trimmedBodies);
  const scriptUsesName = trimmedBodies.some((b) =>
    placeholdersIn(b).includes(NAME_PLACEHOLDER),
  );
  const scriptOn = canScript && seedConversations;
  const unnamedRows =
    scriptOn && scriptUsesName ? countRowsWithoutName(parsed?.rows ?? []) : 0;
  const scriptBlocksImport = scriptOn && !scriptIsValid;

  const canImport =
    !importing &&
    !tooManyRows &&
    !scriptBlocksImport &&
    (parsed?.rows.length ?? 0) > 0;

  const reset = () => {
    setFileName(null);
    setFile(null);
    setMap({ number: 0, name: 1, age: null });
    setResult(null);
    setImporting(false);
    setSeedInbox(false);
    setSeedConversations(false);
    setBodies([""]);
    setSeedContext("");
    setMaxMessages(4);
    setMediaKind("image");
    setMediaId(undefined);
    setMediaName(undefined);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const pickFile = async (picked: File) => {
    setResult(null);
    setFileName(picked.name);
    const text = await readDelimitedFile(picked);
    const read = readLeadImportFile(text);
    setFile(read);
    setMap(read.guess);
  };

  const downloadTemplate = downloadLeadImportTemplate;

  const runImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setImporting(true);

    const { result: outcome, error } = await importLeadsAction(
      parsed.rows,
      onExisting,
      seedInbox,
      scriptOn
        ? {
            bodies: trimmedBodies,
            maxMessages,
            ...(seedContext.trim() ? { context: seedContext.trim() } : {}),
            ...(mediaId ? { attachment: { mediaId, kind: mediaKind } } : {}),
          }
        : undefined,
    );
    setImporting(false);

    if (error || !outcome) {
      toast({
        title: t("error.title"),
        description: error ?? t("error.generic"),
        variant: "destructive",
      });
      return;
    }

    setResult(outcome);
    onImported();
  };

  const columnLabel = (index: number) =>
    file?.headers?.[index]?.trim() || t("mapping.column", { index: index + 1 });

  const columnOptions = Array.from({ length: file?.columnCount ?? 0 }, (_, i) => i);

  return (
    <ElevatedDialog open={open} onOpenChange={close}>
      <ElevatedDialogContent className="max-w-2xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <ElevatedDialogBody>
          {result ? (
            <ImportSummary result={result} />
          ) : (
            <div className="space-y-4">
              {}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<UploadSimple weight="bold" />}
                  iconVisible
                  title={fileName ?? t("chooseFile")}
                  onClick={() => inputRef.current?.click()}
                />
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={async (e) => {
                    const picked = e.target.files?.[0];
                    if (picked) await pickFile(picked);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<DownloadSimple weight="bold" />}
                  iconVisible
                  title={t("template")}
                  onClick={downloadTemplate}
                />
              </div>

              {
}
              <p className="text-xs text-muted-foreground">
                {t("recognisedColumns")}
              </p>

              {file ? (
                <>
                  {}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {t("mapping.title")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {file.headers ? t("mapping.detected") : t("mapping.noHeader")}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <ElevatedSelect
                        label={t("mapping.number")}
                        value={String(map.number)}
                        onValueChange={(v) => setMap({ ...map, number: Number(v) })}
                      >
                        {columnOptions.map((i) => (
                          <ElevatedSelectItem key={i} value={String(i)}>
                            {columnLabel(i)}
                          </ElevatedSelectItem>
                        ))}
                      </ElevatedSelect>

                      <ElevatedSelect
                        label={t("mapping.name")}
                        value={map.name === null ? NO_COLUMN : String(map.name)}
                        onValueChange={(v) =>
                          setMap({ ...map, name: v === NO_COLUMN ? null : Number(v) })
                        }
                      >
                        <ElevatedSelectItem value={NO_COLUMN}>
                          {t("mapping.none")}
                        </ElevatedSelectItem>
                        {columnOptions.map((i) => (
                          <ElevatedSelectItem key={i} value={String(i)}>
                            {columnLabel(i)}
                          </ElevatedSelectItem>
                        ))}
                      </ElevatedSelect>

                      <ElevatedSelect
                        label={t("mapping.age")}
                        value={map.age === null ? NO_COLUMN : String(map.age)}
                        onValueChange={(v) =>
                          setMap({ ...map, age: v === NO_COLUMN ? null : Number(v) })
                        }
                      >
                        <ElevatedSelectItem value={NO_COLUMN}>
                          {t("mapping.none")}
                        </ElevatedSelectItem>
                        {columnOptions.map((i) => (
                          <ElevatedSelectItem key={i} value={String(i)}>
                            {columnLabel(i)}
                          </ElevatedSelectItem>
                        ))}
                      </ElevatedSelect>
                    </div>

                    {
}
                    <p className="text-xs text-muted-foreground">{t("mapping.onlyThese")}</p>
                  </div>

                  {}
                  <div className="rounded-[--radius] border border-border bg-card px-3 py-2">
                    <p className="text-sm text-foreground">
                      {t("summary.counts", {
                        valid: parsed?.rows.length ?? 0,
                        invalid: parsed?.invalid ?? 0,
                        duplicates: parsed?.duplicates ?? 0,
                      })}
                    </p>

                    {tooManyRows ? (
                      <p className="mt-1 text-xs font-semibold text-destructive-ink">
                        {t("summary.tooMany", { max: LEAD_IMPORT_MAX_ROWS })}
                      </p>
                    ) : null}

                    {parsed && parsed.rejected.length > 0 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-foreground">
                          {t("summary.rejectedTitle", { count: parsed.rejected.length })}
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {parsed.rejected.slice(0, REJECTED_PREVIEW).map((item) => (
                            <li
                              key={item.line}
                              className="flex gap-2 text-2xs text-muted-foreground"
                            >
                              <span className="shrink-0 tabular-nums">#{item.line}</span>
                              <span className="min-w-0 flex-1 truncate font-mono">
                                {item.raw}
                              </span>
                              <span className="shrink-0 text-warning-ink">
                                {t(`reasons.${item.reason}`)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {parsed.rejected.length > REJECTED_PREVIEW ? (
                          <p className="mt-1 text-2xs text-muted-foreground">
                            +{parsed.rejected.length - REJECTED_PREVIEW}
                          </p>
                        ) : null}
                      </details>
                    ) : null}
                  </div>

                  {}
                  <ElevatedSelect
                    label={t("existing.label")}
                    value={onExisting}
                    onValueChange={(v) => setOnExisting(v as "fill_empty" | "skip")}
                  >
                    <ElevatedSelectItem value="fill_empty">
                      {t("existing.fillEmpty")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="skip">
                      {t("existing.skip")}
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                  <p className="text-xs text-muted-foreground">{t("existing.neverOverwrites")}</p>

                  {
}
                  {canSeedInbox ? (
                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                        <Checkbox
                          className="mt-0.5"
                          checked={seedInbox}
                          onCheckedChange={(next) => {
                            const on = next === true;
                            setSeedInbox(on);
                            if (!on) setSeedConversations(false);
                          }}
                        />
                        <span>
                          {t("seedInbox.label")}
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {t("seedInbox.help")}
                          </span>
                        </span>
                      </label>

                      {
}
                      {canScript ? (
                        <div className="space-y-3 rounded-[--radius] border border-border bg-card/40 p-3">
                          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                            <Checkbox
                              className="mt-0.5"
                              checked={seedConversations}
                              onCheckedChange={(next) =>
                                setSeedConversations(next === true)
                              }
                            />
                            <span>
                              <span className="flex flex-wrap items-center gap-2">
                                {t("seedConversations.label")}
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {t("seedConversations.adminOnly")}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {t("seedConversations.help")}
                              </span>
                            </span>
                          </label>

                          {seedConversations ? (
                            <div className="space-y-3 border-t border-border pt-3">
                              <MessageVariantsEditor
                                bodies={bodies}
                                onChange={setBodies}
                                max={MAX_SEED_VARIANTS}
                                disabled={importing}
                                rows={3}
                                labels={{
                                  title: t("seedConversations.variantsTitle"),
                                  help: t("seedConversations.variantsHelp"),
                                  addVariant: t("seedConversations.addVariant"),
                                  removeVariant: t(
                                    "seedConversations.removeVariant",
                                  ),
                                  variantLabel: (index) =>
                                    t("seedConversations.variantLabel", { index }),
                                  bodyPlaceholder: t(
                                    "seedConversations.bodyPlaceholder",
                                  ),
                                  mismatch: t("seedConversations.variantsMismatch"),
                                  variablesDetected: () =>
                                    t("seedConversations.nameVariable"),
                                }}
                              />

                              <ElevatedInput
                                label={t("seedConversations.contextLabel")}
                                value={seedContext}
                                onChange={(e) => setSeedContext(e.target.value)}
                                disabled={importing}
                                controlSize="sm"
                                maxLength={SEED_CONTEXT_MAX}
                                placeholder={t(
                                  "seedConversations.contextPlaceholder",
                                )}
                              />

                              {
}
                              <div className="space-y-2 border-t border-border pt-3">
                                <p className="text-sm font-medium text-foreground">
                                  {t("seedConversations.mediaTitle")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t("seedConversations.mediaHelp")}
                                </p>
                                <ElevatedSelect
                                  label={t("seedConversations.mediaKind")}
                                  value={mediaKind}
                                  onValueChange={(v) => {
                                    setMediaKind(v as SeedMediaKind);
                                    setMediaId(undefined);
                                    setMediaName(undefined);
                                  }}
                                >
                                  {SEED_MEDIA_KINDS.map((kind) => (
                                    <ElevatedSelectItem key={kind} value={kind}>
                                      {t(`seedConversations.mediaKinds.${kind}`)}
                                    </ElevatedSelectItem>
                                  ))}
                                </ElevatedSelect>
                                <CampaignMediaPicker
                                  kind={mediaKind}
                                  mediaId={mediaId}
                                  fileName={mediaName}
                                  accept={MEDIA_ACCEPT[mediaKind] ?? "*/*"}
                                  disabled={importing}
                                  onChange={(next) => {
                                    setMediaId(next.mediaId);
                                    setMediaName(next.fileName);
                                  }}
                                  labels={{
                                    upload: t("seedConversations.mediaUpload"),
                                    uploading: t("seedConversations.mediaUploading"),
                                    remove: t("seedConversations.mediaRemove"),
                                    failed: t("seedConversations.mediaFailed"),
                                  }}
                                />
                              </div>

                              <ElevatedSelect
                                label={t("seedConversations.maxMessages")}
                                value={String(maxMessages)}
                                onValueChange={(v) => setMaxMessages(Number(v))}
                              >
                                {SEED_MESSAGE_OPTIONS.map((n) => (
                                  <ElevatedSelectItem key={n} value={String(n)}>
                                    {t("seedConversations.messageCount", {
                                      count: n,
                                    })}
                                  </ElevatedSelectItem>
                                ))}
                              </ElevatedSelect>

                              {
}
                              {unnamedRows > 0 ? (
                                <p className="text-xs text-warning-ink">
                                  {t("seedConversations.unnamedRows", {
                                    count: unnamedRows,
                                  })}
                                </p>
                              ) : null}

                              {
}
                              <p className="text-2xs text-muted-foreground">
                                {t("seedConversations.costNotice", {
                                  max: MAX_SEEDED_CONVERSATIONS,
                                })}
                              </p>

                              {scriptBlocksImport ? (
                                <p className="text-xs font-semibold text-destructive-ink">
                                  {t("seedConversations.invalid")}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              )}
            </div>
          )}
        </ElevatedDialogBody>

        <ElevatedDialogFooter>
          {result ? (
            <Button variant="primary" title={t("done")} onClick={() => close(false)} />
          ) : (
            <>
              <Button
                variant="ghost"
                title={t("cancel")}
                onClick={() => close(false)}
                disabled={importing}
              />
              <Button
                variant="primary"
                title={importing ? t("importing") : t("confirm")}
                onClick={runImport}
                disabled={!canImport}
              />
            </>
          )}
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function ImportSummary({ result }: { result: LeadImportResult }) {
  const t = useTranslations("leadsPage.import");

  const tiles = [
    {
      key: "created",
      label: t("result.created"),
      value: result.created,
      tone: "text-healthy-ink",
      icon: CheckCircle,
    },
    {
      key: "matched",
      label: t("result.matched"),
      value: result.matched,
      tone: "text-info-ink",
      icon: Users,
    },
  ];

  const skipped = result.invalid + result.duplicate;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="rounded-[--radius] border border-border bg-card p-3"
          >
            <div className="flex items-center gap-2">
              <tile.icon className={cn("h-4 w-4", tile.tone)} weight="fill" />
              <p className="truncate text-2xs font-semibold text-muted-foreground">
                {tile.label}
              </p>
            </div>
            <p className="readout mt-1 font-display text-2xl font-semibold text-foreground">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {skipped > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("result.skipped", {
            invalid: result.invalid,
            duplicates: result.duplicate,
          })}
        </p>
      ) : null}

      {
}
      {result.blocked > 0 ? (
        <p className="text-xs text-warning-ink">
          {t("result.blocked", { count: result.blocked })}
        </p>
      ) : null}

      {
}
      {result.inboxSeedError ? (
        <p className="text-xs text-warning-ink">{t("result.inboxSeedFailed")}</p>
      ) : result.inboxSeedQueued ? (
        <p className="text-xs text-muted-foreground">
          {t("result.inboxSeedQueued", { count: result.inboxSeedQueued })}
        </p>
      ) : null}

      {
}
      {result.scriptedSeedError ? (
        <p className="text-xs text-warning-ink">
          {t("result.scriptedSeedFailed")}
        </p>
      ) : result.scriptedSeedQueued ? (
        <p className="text-xs text-muted-foreground">
          {t("result.scriptedSeedQueued", { count: result.scriptedSeedQueued })}
        </p>
      ) : null}
    </div>
  );
}

export default ImportLeadsDialog;
