"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteFormResponseAction } from "@/app/actions/whatsapp-forms";
import { ScreenLoader } from "@/components/brand/screen-loader";
import Button from "@/components/elevated-design/button";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ArrowSquareOut, EyeSlash, Trash } from "@/components/icons";
import { MediaDownloadButton } from "@/components/media/media-download-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useFormAccess, useFormOptions, useFormResponse, useRefreshForms } from "@/hooks/use-whatsapp-forms";
import { conversationHref, isEntryType } from "@/lib/conversations/deep-link";
import { leadDetailHref } from "@/lib/leads/detail";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { answersByScreen, answerText, fieldPrompt } from "@/lib/whatsapp-forms/answers";
import type { ResponseDetail } from "@/lib/whatsapp-forms/types";

import { useAnswerWords, useFormError, useLeadSlotLabel } from "../use-form-text";

function SlotList({ title, slots, label }: { title: string; slots?: string[]; label: (slot: string) => string }) {
  if (!slots || slots.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <li key={slot} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground">
            {label(slot)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResponseBody({ detail, onDeleted }: { detail: ResponseDetail; onDeleted: () => void }) {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const access = useFormAccess();
  const options = useFormOptions();
  const words = useAnswerWords();
  const errorText = useFormError();
  const refresh = useRefreshForms();
  const slotLabel = useLeadSlotLabel(options.data?.customFields ?? []);
  const [confirming, setConfirming] = useState(false);
  const { response, version } = detail;
  const groups = answersByScreen(version.document, response.answers);
  const mediaByFile = new Map((response.report.files ?? []).map((file) => [file.fileId, file.mediaId]));
  const conversation = response.entryId && response.entryType && isEntryType(response.entryType) ? conversationHref(response.entryId, response.entryType) : null;
  const unknown = Object.keys(response.answers.unknown ?? {});

  const remove = async () => {
    const answer = await deleteFormResponseAction(response.id);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return false;
    }
    toast.success(t("response.deleted"));
    void refresh(detail.form.id);
    onDeleted();
    return true;
  };

  return (
    <div className="space-y-5 px-6 pb-6">
      <div className="flex flex-wrap gap-2">
        {response.leadId ? (
          <Button variant="secondary" size="sm" title={t("response.openLead")} icon={<ArrowSquareOut className="h-3.5 w-3.5" />} iconVisible iconSide="left" link={leadDetailHref(response.leadId)} newTab={false} />
        ) : null}
        {conversation ? (
          <Button variant="secondary" size="sm" title={t("response.openConversation")} icon={<ArrowSquareOut className="h-3.5 w-3.5" />} iconVisible iconSide="left" link={conversation} newTab={false} />
        ) : null}
      </div>

      {!response.formId || response.match.startsWith("unmatched") ? <Notice tone="neutral">{t("response.unmatched")}</Notice> : null}
      {!detail.revealed && !access.sensitive ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeSlash className="h-3.5 w-3.5" />
          {t("response.hidden")}
        </p>
      ) : null}

      {groups.map((group, index) => (
        <section key={group.screen.key} className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">{t("response.screen", { n: index + 1, title: group.screen.title })}</h3>
          <dl className="divide-y divide-border rounded-[--radius] border border-border">
            {group.items.map(({ field, answer }) => {
              const text = answerText(answer, field, words);
              return (
                <div key={field.key} className="space-y-1 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{fieldPrompt(field) || field.key}</dt>
                  <dd className="text-sm text-foreground">
                    {answer?.files && answer.files.length > 0 ? (
                      <ul className="space-y-1">
                        {answer.files.map((file) => {
                          const mediaId = mediaByFile.get(file.id);
                          return (
                            <li key={file.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{file.name || file.id}</span>
                              {mediaId ? <MediaDownloadButton mediaId={mediaId} description={file.name || file.id} /> : <span className="text-xs text-muted-foreground">{t("response.fileUnavailable")}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : text ? (
                      <span className="whitespace-pre-line">{text}</span>
                    ) : (
                      <EmptyValue />
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}

      {unknown.length > 0 ? (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground">{t("response.unknownAnswers")}</h3>
          <dl className="divide-y divide-border rounded-[--radius] border border-border">
            {unknown.map((key) => (
              <div key={key} className="px-3 py-2">
                <dt className="text-xs text-muted-foreground">{key}</dt>
                <dd className="break-words text-sm text-foreground">{JSON.stringify(response.answers.unknown?.[key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="space-y-3 rounded-[--radius] border border-border p-3">
        <h3 className="text-sm font-semibold text-foreground">{t("response.report")}</h3>
        <SlotList title={t("response.changed")} slots={response.report.changed} label={slotLabel} />
        <SlotList title={t("response.conflicts")} slots={response.report.conflicts} label={slotLabel} />
        <SlotList title={t("response.refused")} slots={response.report.refused} label={slotLabel} />
        {response.report.consent ? <p className="text-xs text-foreground">{t("response.consent", { value: response.report.consent })}</p> : null}
        {response.report.triggered ? <p className="text-xs text-foreground">{t("response.triggered")}</p> : null}
        {response.report.resumed ? <p className="text-xs text-foreground">{t("response.resumed")}</p> : null}
        {!response.report.changed?.length && !response.report.conflicts?.length && !response.report.refused?.length ? (
          <p className="text-xs text-muted-foreground">{t(`response.apply.${response.applyStatus}`)}</p>
        ) : null}
      </section>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t("response.submittedAt")}</dt>
        <dd className="text-right text-foreground">{format.dateTime(new Date(response.submittedAt), { dateStyle: "short", timeStyle: "short" })}</dd>
        <dt className="text-muted-foreground">{t("response.version")}</dt>
        <dd className="text-right text-foreground">{t("versions.number", { number: version.number })}</dd>
        <dt className="text-muted-foreground">{t("responses.columns.origin")}</dt>
        <dd className="text-right text-foreground">{response.origin ? t(`origin.${response.origin}`) : <EmptyValue />}</dd>
      </dl>

      {access.deleteResponses ? (
        <>
          <Button variant="destructive" size="sm" title={t("response.delete")} icon={<Trash className="h-3.5 w-3.5" />} iconVisible iconSide="left" onClick={() => setConfirming(true)} />
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t("response.deleteTitle")}
            description={t("response.deleteDescription")}
            confirmLabel={t("response.delete")}
            cancelLabel={t("common.cancel")}
            tone="danger"
            onConfirm={remove}
          />
        </>
      ) : null}
    </div>
  );
}

export function ResponseSheet({ responseId, onClose }: { responseId: string; onClose: () => void }) {
  const t = useTranslations("whatsappForms");
  const query = useFormResponse(responseId);
  const detail = query.data;
  return (
    <ElevatedSheet open onOpenChange={(open) => !open && onClose()}>
      <ElevatedSheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle>{detail?.leadName || (detail ? formatPhoneForDisplay(detail.response.contactNumber) : t("response.title"))}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{detail ? detail.form.name : t("response.title")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        {query.isPending ? <ScreenLoader fit="fill" /> : null}
        {query.isError && !detail ? (
          <div className="px-6">
            <Notice tone="fault">{t("common.errorTitle")}</Notice>
          </div>
        ) : null}
        {detail ? <ResponseBody detail={detail} onDeleted={onClose} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
