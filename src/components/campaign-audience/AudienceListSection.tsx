"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  addAudienceRowAction,
  downloadAudienceSampleAction,
  editAudienceRowAction,
  pasteAudienceListAction,
  removeAudienceRowAction,
  uploadAudienceListAction,
} from "@/app/actions/campaign-audience";
import Button from "@/components/elevated-design/button";
import { CircleNotch, ClipboardText, DownloadSimple, Plus, UploadSimple } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { CodedRefusal } from "@/lib/api/coded-error";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import { OPEN_CONTACT_LIST_VIEW, onlyMissingView, type ContactListView } from "@/lib/campaigns/contact-list-view";
import type { BindableField, ListPreview, ListRow, MetadataColumn, RowInput, VariableCount } from "@/lib/campaign-audience/types";

import { AudienceCountFigures } from "./AudienceCountPanel";
import { ListColumnsNotice, ListFileLine, ListMatchingNotice, ListMetadataNotice, ListMissingNotice, SkippedLinesNotice } from "./ListPreviewNotices";
import { ListRowDialog } from "./ListRowDialog";
import { ListRowsTable } from "./ListRowsTable";
import { PasteListDialog } from "./PasteListDialog";
import { useAudienceErrorText } from "./use-audience-copy";
import type { AudienceLeadFocus } from "./AudienceLeadsSheet";
import type { CampaignAudience } from "./use-campaign-audience";

const UPLOAD_ACCEPT = ".csv,.tsv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type RowEditor = { row: ListRow | null } | null;

const NO_VARIABLES: readonly VariableCount[] = [];

function metadataColumnsOf(preview: ListPreview | null): MetadataColumn[] {
  const columns = preview?.columns.metadata ?? [];
  const lacking = (preview?.metadataMissing ?? []).filter((gap) => !columns.some((known) => known.key === gap.key));
  return [...columns, ...lacking.map((gap) => ({ key: gap.key, label: gap.key }))];
}

export function AudienceListSection({
  audience,
  fields,
  readOnly = false,
  onOpen,
}: {
  audience: CampaignAudience;
  fields: readonly BindableField[];
  readOnly?: boolean;
  onOpen?: (focus: AudienceLeadFocus) => void;
}) {
  const t = useTranslations("campaignAudience.step.list");
  const errorText = useAudienceErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "paste" | "row" | "sample" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [editor, setEditor] = useState<RowEditor>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [view, setView] = useState<ContactListView>(OPEN_CONTACT_LIST_VIEW);
  const { channel, preview, count, draft, context } = audience;
  const contact = channel === "email" ? "email" : "phone";
  const slots = channel === "email" ? 0 : Math.max(count?.requiredVariables ?? 0, preview?.variableColumns ?? 0);
  const metadata = metadataColumnsOf(preview);
  const variables = count?.variables ?? NO_VARIABLES;

  const settle = (answer: ParsedAnswer<ListPreview>, onError: (refusal: CodedRefusal) => void): boolean => {
    if (answer.error) {
      onError(answer.error);
      return false;
    }
    audience.acceptList(answer.data);
    setView(OPEN_CONTACT_LIST_VIEW);
    return true;
  };

  const upload = async (file: File) => {
    setBusy("upload");
    setFailure(null);
    settle(await uploadAudienceListAction(channel, file, context), (refusal) => setFailure(errorText(refusal)));
    setBusy(null);
  };

  const paste = async (text: string) => {
    setBusy("paste");
    setFailure(null);
    if (settle(await pasteAudienceListAction(channel, text, context), (refusal) => setFailure(errorText(refusal)))) setPasting(false);
    setBusy(null);
  };

  const sample = async () => {
    setBusy("sample");
    setFailure(null);
    const outcome = await downloadAudienceSampleAction(channel, context, "csv");
    if (outcome.error) setFailure(errorText(outcome.error));
    setBusy(null);
  };

  const ensureList = async (): Promise<string | null> => {
    if (draft.listId) return draft.listId;
    const answer = await pasteAudienceListAction(channel, "", context);
    return settle(answer, (refusal) => setRowError(errorText(refusal))) && answer.data ? answer.data.id : null;
  };

  const saveRow = async (input: RowInput) => {
    setBusy("row");
    setRowError(null);
    const listId = await ensureList();
    const row = editor?.row;
    const answer = listId ? (row ? await editAudienceRowAction(channel, listId, row.id, input) : await addAudienceRowAction(channel, listId, input)) : null;
    setBusy(null);
    if (!answer) return;
    if (answer.error) {
      setRowError(errorText(answer.error));
      return;
    }
    setEditor(null);
    audience.refreshList();
  };

  const removeRow = async (row: ListRow) => {
    if (!draft.listId) return;
    setFailure(null);
    const answer = await removeAudienceRowAction(channel, draft.listId, row.id);
    if (answer.error) setFailure(errorText(answer.error));
    else audience.refreshList();
  };

  return (
    <div className="space-y-4">
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="hidden"
            data-testid="audience-list-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button type="button" variant="secondary" size="sm" title={t("sample")} icon={<DownloadSimple className="h-4 w-4" weight="bold" />} iconVisible iconSide="left" disabled={busy !== null} onClick={() => void sample()} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            title={busy === "upload" ? t("uploading") : t("upload")}
            icon={busy === "upload" ? <CircleNotch className="h-4 w-4 animate-spin" /> : <UploadSimple className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          />
          <Button type="button" variant="secondary" size="sm" title={t("paste")} icon={<ClipboardText className="h-4 w-4" />} iconVisible iconSide="left" disabled={busy !== null} onClick={() => setPasting(true)} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            title={t("addContact")}
            icon={<Plus className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            disabled={busy !== null}
            onClick={() => {
              setRowError(null);
              setEditor({ row: null });
            }}
          />
          <span className="ml-2 text-xs text-muted-foreground">{t(contact === "email" ? "sampleHintEmail" : "sampleHint")}</span>
        </div>
      )}

      {failure ? (
        <Notice tone="fault">
          <p>{failure}</p>
        </Notice>
      ) : null}

      {audience.previewError && draft.listId ? (
        <Notice tone="fault">
          <p>{errorText(audience.previewError)}</p>
        </Notice>
      ) : null}

      {preview ? (
        <>
          <ListFileLine preview={preview} />
          {contact === "phone" ? <ListColumnsNotice preview={preview} fields={fields} variables={variables} /> : null}
          <SkippedLinesNotice preview={preview} />
          <ListMetadataNotice gaps={preview.metadataMissing} />
          <ListMatchingNotice preview={preview} channel={channel} />
          <AudienceCountFigures
            channel={channel}
            source="list"
            count={count}
            lines={preview.lines}
            loading={audience.counting}
            createState={audience.createState}
            fields={fields}
            onOpen={onOpen}
          />
          {audience.countError && !audience.counting ? (
            <Notice tone="fault">
              <p>{errorText(audience.countError)}</p>
            </Notice>
          ) : null}
          {count ? <ListMissingNotice variables={count.variables} onShow={() => setView(onlyMissingView(view))} /> : null}
          <ListRowsTable
            channel={channel}
            listId={preview.id}
            context={context}
            contact={contact}
            total={preview.rows}
            slots={slots}
            variables={variables}
            metadata={metadata}
            checksMetadata={preview.metadataMissing.length > 0}
            view={view}
            onViewChange={setView}
            onEdit={(row) => {
              setRowError(null);
              setEditor({ row });
            }}
            onRemove={(row) => void removeRow(row)}
            readOnly={readOnly}
          />
        </>
      ) : null}

      {pasting ? <PasteListDialog open contact={contact} saving={busy === "paste"} error={failure} onSubmit={(text) => void paste(text)} onClose={() => setPasting(false)} /> : null}
      {editor ? (
        <ListRowDialog
          open
          row={editor.row}
          contact={contact}
          slots={slots}
          variables={variables}
          metadata={metadata}
          saving={busy === "row"}
          error={rowError}
          onSave={(input) => void saveRow(input)}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </div>
  );
}
