"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listMercadoLivreReasonsAction, sendMercadoLivreReasonAction } from "@/app/actions/mercadolivre";
import { TextLimitFeedback } from "@/components/crm/TextLimitFeedback";
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
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import Textarea from "@/components/elevated-design/elevated-textarea";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { PaperPlaneTilt } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { textLimitState } from "@/lib/conversations/text-limit";
import type { EntryType } from "@/lib/conversations/types";
import {
  reasonAcceptsText,
  reasonAvailability,
  reasonErrorKey,
  reasonLabelKey,
  reasonSendBody,
  reasonTextLimit,
  type ReasonChoice,
} from "@/lib/mercadolivre/reasons";
import type { MercadoLivreReasonOption } from "@/lib/mercadolivre/types";
import { cn } from "@/lib/utils";

const TEXT_CHOICE = "text";

const REFRESHING_REFUSALS = new Set(["reason_unknown", "reason_unavailable", "reason_cap_reached"]);

type LoadState = { status: "loading" } | { status: "failed"; code?: string } | { status: "ready"; options: MercadoLivreReasonOption[] };

function firstChoice(option: MercadoLivreReasonOption): string {
  return option.templates[0]?.id ?? TEXT_CHOICE;
}

export function MercadoLivreStartConversation({
  entryId,
  entryType,
  canSend,
}: {
  entryId: string;
  entryType: EntryType;
  canSend: boolean;
}) {
  const t = useTranslations("mercadolivre.reasons");
  const [open, setOpen] = useState(false);

  if (entryType !== "mercadolivre" || !canSend) return null;

  return (
    <>
      <TooltipWrapper content={t("actionHint")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("action")}
          className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-2xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PaperPlaneTilt className="h-4 w-4" />
          <span className="hidden xl:inline">{t("action")}</span>
        </button>
      </TooltipWrapper>
      {open ? <StartConversationDialog entryId={entryId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function StartConversationDialog({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const t = useTranslations("mercadolivre.reasons");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choice, setChoice] = useState(TEXT_CHOICE);
  const [text, setText] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMercadoLivreReasonsAction(entryId).then((result) => {
      if (cancelled) return;
      setState("error" in result ? { status: "failed", code: result.code } : { status: "ready", options: result.options });
    });
    return () => {
      cancelled = true;
    };
  }, [entryId, reloadKey]);

  const options = state.status === "ready" ? state.options : [];
  const selected = options.find((option) => option.id === selectedId) ?? null;

  const select = useCallback((option: MercadoLivreReasonOption) => {
    setSelectedId(option.id);
    setChoice(firstChoice(option));
    setValues({});
    setError(null);
  }, []);

  const currentChoice = (): ReasonChoice =>
    choice === TEXT_CHOICE ? { kind: "text", text } : { kind: "template", templateId: choice, values };

  const send = async () => {
    if (!selected) return;
    const built = reasonSendBody(selected, currentChoice());
    if ("error" in built) {
      setError(t(`local.${built.error}`));
      return;
    }
    setSending(true);
    setError(null);
    const result = await sendMercadoLivreReasonAction(entryId, built.body);
    setSending(false);
    if ("error" in result) {
      setError(t(reasonErrorKey(result.code)));
      if (result.code && REFRESHING_REFUSALS.has(result.code)) setReloadKey((key) => key + 1);
      return;
    }
    toast(t("sent"));
    onClose();
  };

  const template = selected?.templates.find((candidate) => candidate.id === choice);
  const textLimit = selected ? reasonTextLimit(selected) : null;
  const textState = selected && choice === TEXT_CHOICE ? textLimitState(text, textLimit) : null;
  const textBlocked = choice === TEXT_CHOICE && (text.trim() === "" || (textState?.refused ?? true));

  return (
    <ElevatedDialog open onOpenChange={(next) => !next && onClose()}>
      <ElevatedDialogContent className="flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription className="text-xs">{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-sleek">
          {state.status === "loading" ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
          {state.status === "failed" ? (
            <Notice tone="fault">
              <p>{t(reasonErrorKey(state.code))}</p>
              <Button size="sm" variant="secondary" title={t("retry")} onClick={() => setReloadKey((key) => key + 1)} />
            </Notice>
          ) : null}
          {state.status === "ready" && options.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}

          {options.length > 0 ? (
            <div role="radiogroup" aria-label={t("title")} className="space-y-2">
              {options.map((option) => {
                const availability = reasonAvailability(option);
                const labelKey = reasonLabelKey(option.id);
                const checked = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    disabled={availability !== "available" || sending}
                    onClick={() => select(option)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                      checked ? "border-primary-edge bg-muted" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{labelKey ? t(labelKey) : option.id}</span>
                      {availability === "unavailable" ? (
                        <span className="block text-xs text-muted-foreground">{t("unavailableMark")}</span>
                      ) : null}
                    </span>
                    <StatusChip
                      tone={availability === "available" ? "outline" : "muted"}
                      label={t("remaining", { count: Math.max(0, option.capAvailable) })}
                      className="shrink-0 px-2 text-2xs"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}

          {selected ? (
            <div className="space-y-3 border-t border-border pt-4">
              {selected.templates.length > 0 && (selected.templates.length > 1 || reasonAcceptsText(selected)) ? (
                <ElevatedPillToggle<string>
                  aria-label={t("templateLabel")}
                  value={choice}
                  onChange={(next) => {
                    setChoice(next);
                    setValues({});
                    setError(null);
                  }}
                  options={[
                    ...selected.templates.map((candidate, index) => ({ value: candidate.id, label: t("template", { number: index + 1 }) })),
                    ...(reasonAcceptsText(selected) ? [{ value: TEXT_CHOICE, label: t("textLabel") }] : []),
                  ]}
                />
              ) : null}

              {template ? (
                <div className="space-y-2">
                  {template.vars.map((variable) => (
                    <div key={variable.id} className="space-y-1">
                      <ElevatedInput
                        label={variable.id}
                        type="text"
                        inputMode="numeric"
                        value={values[variable.id] ?? ""}
                        onChange={(event) => setValues((prev) => ({ ...prev, [variable.id]: event.target.value }))}
                        disabled={sending}
                        controlSize="sm"
                      />
                      <p className="text-2xs text-muted-foreground">{t("variableHint")}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {choice === TEXT_CHOICE ? (
                <div>
                  <Textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={4}
                    aria-label={t("textLabel")}
                    placeholder={t("textPlaceholder")}
                    disabled={sending}
                    className="resize-y"
                  />
                  <TextLimitFeedback state={textState} />
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <Notice tone="fault">
              <p>{error}</p>
            </Notice>
          ) : null}
        </div>

        <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button title={t("cancel")} variant="ghost" onClick={onClose} />
          <Button title={t("send")} variant="primary" disabled={!selected || sending || textBlocked} onClick={() => void send()} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
