"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { PendingOutcomeRequest } from "@/lib/conversations/types";

import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import Button from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";

const LAST_OUTCOME_KEY = "vozko:last-outcome-code";

function readLastOutcome(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_OUTCOME_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberOutcome(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_OUTCOME_KEY, code);
  } catch {
    return;
  }
}

export function OutcomePickerDialog({
  request,
  onConfirm,
  onCancel,
}: {
  request: PendingOutcomeRequest | null;
  onConfirm: (
    entryId: string,
    entryType: string,
    status: string,
    outcomeCode: string,
  ) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("crm.outcomeCapture");
  const requestKey = request
    ? `${request.entryType}:${request.entryId}:${request.status}`
    : "";
  const [selected, setSelected] = useState("");
  const [syncedKey, setSyncedKey] = useState("");

  if (requestKey !== syncedKey) {
    setSyncedKey(requestKey);
    if (!request) {
      setSelected("");
    } else {
      const last = readLastOutcome();
      const stillOffered = request.outcomes.some((o) => o.code === last);
      setSelected(stillOffered ? last : (request.outcomes[0]?.code ?? ""));
    }
  }

  if (!request) return null;

  const confirm = () => {
    if (!selected) return;
    rememberOutcome(selected);
    onConfirm(request.entryId, request.entryType, request.status, selected);
  };

  return (
    <ElevatedDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <ElevatedDialogContent className="w-[95vw] max-w-[440px]">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {request.message || t("description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <ElevatedDialogBody>
          {request.outcomes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {t("noCatalogue")}
            </p>
          ) : (
            <ul className="space-y-1.5" role="radiogroup" aria-label={t("title")}>
              {request.outcomes.map((outcome) => (
                <li key={outcome.code}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected === outcome.code}
                    onClick={() => setSelected(outcome.code)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") confirm();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-[--radius] border px-3 py-2 text-left text-sm",
                      selected === outcome.code
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{outcome.label}</span>
                    {outcome.isDurable ? (
                      <span className="text-2xs font-semibold uppercase tracking-wide text-healthy-ink">
                        {t("durable")}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ElevatedDialogBody>

        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onCancel} />
          <Button
            variant="primary"
            title={t("confirm")}
            onClick={confirm}
            disabled={!selected || request.outcomes.length === 0}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
