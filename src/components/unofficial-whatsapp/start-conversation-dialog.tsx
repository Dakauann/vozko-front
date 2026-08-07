"use client";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { listInstancesAction, startConversationAction } from "@/app/actions/unofficial-whatsapp";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { SessionState } from "@/components/unofficial-whatsapp/session-state";
import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { CheckCircle, Warning } from "@/components/icons";
import { cn } from "@/lib/utils";
import { normalizeRecipients } from "@/lib/unofficial-whatsapp/recipients";
import { useTranslations } from "next-intl";

/**
 * Reach a number that never wrote to us.
 *
 * The whole dialog is built around one warning, because this is the riskiest
 * ordinary action on the channel: messaging someone who never contacted you is
 * cold outbound, and on an unofficial number it is the fastest route to a ban
 * that nobody can reverse. The copy says so plainly rather than burying it —
 * an operator who understands why the number died is a different support
 * conversation from one who does not.
 *
 * The number is verified against WhatsApp server-side before anything is
 * written, so "not on WhatsApp" comes back as a normal, actionable answer
 * rather than as a failure.
 */
export function StartConversationDialog({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new entry so the caller can route to it in the inbox. */
  onStarted: (entryId: string, entryType: string) => void;
}) {
  const t = useTranslations("unofficialWhatsapp.startConversation");

  const [instances, setInstances] = useState<UnofficialWhatsAppInstance[]>([]);
  const [instanceId, setInstanceId] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const result = await listInstancesAction(1, 100);
      // Only a live session can reach anyone; offering a disconnected number
      // would fail after the operator typed everything.
      const live = result.instances.filter((instance) => instance.sessionLive);
      setInstances(live);
      if (live.length === 1) setInstanceId(live[0].id);
    })();
  }, [open]);

  // Reset between openings, or the previous attempt's error greets the next one.
  useEffect(() => {
    if (open) return;
    setPhone("");
    setName("");
    setError(null);
  }, [open]);

  // The shared parser, so a pasted number is normalised by exactly the rule
  // the server will apply to it.
  const parsed = useMemo(() => normalizeRecipients(phone), [phone]);
  const validPhone = parsed.valid[0] ?? "";
  const canSubmit = Boolean(instanceId) && Boolean(validPhone) && !busy;

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);

    const result = await startConversationAction(instanceId, {
      phoneNumber: validPhone,
      name: name.trim() || undefined,
    });
    setBusy(false);

    if (result.error || !result.conversation) {
      setError(result.error ?? t("failed"));
      return;
    }
    onStarted(result.conversation.conversationId, result.conversation.entryType);
    onOpenChange(false);
  }, [instanceId, validPhone, name, t, onStarted, onOpenChange]);

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="sm:max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="space-y-5">
          {instances.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {t("noNumbers")}
            </p>
          ) : (
            <>
              {/* Only shown when there is a choice to make. A single connected
                  number needs no picker, and rendering one implies otherwise. */}
              {instances.length > 1 && (
                <div className="space-y-2">
                  <span className="legend">{t("fromLabel")}</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {instances.map((instance) => (
                      <button
                        key={instance.id}
                        type="button"
                        aria-pressed={instanceId === instance.id}
                        onClick={() => setInstanceId(instance.id)}
                        className={cn(
                          "relative overflow-hidden rounded-lg border p-3 text-left transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          instanceId === instance.id
                            ? "border-border-strong bg-muted"
                            : "border-border bg-card hover:bg-muted",
                        )}
                      >
                        {instanceId === instance.id && (
                          <span
                            aria-hidden
                            className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-primary"
                          />
                        )}
                        <p className="readout truncate text-sm text-foreground">
                          {instance.phoneNumber
                            ? `+${instance.phoneNumber}`
                            : instance.displayName}
                        </p>
                        <div className="mt-1.5">
                          <SessionState instance={instance} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* The number field owns its own feedback line rather than
                  borrowing the dialog's rhythm with a negative margin. */}
              <div className="space-y-1.5">
                <ElevatedInput
                  label={t("phoneLabel")}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="5511999999999"
                  inputMode="tel"
                  className="w-full font-mono"
                />
                {/* What we will ACTUALLY dial, echoed back as it is typed.
                    Operators paste from spreadsheets with dashes, parentheses
                    and country prefixes in every arrangement, and without this
                    the field silently swallows all of it and then either works
                    or fails on submit. Showing the resolved number turns a
                    guess into a check the operator can make before sending. */}
                {validPhone ? (
                  <p className="flex items-center gap-1.5 text-xs text-healthy-ink">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" weight="fill" aria-hidden />
                    <span className="readout font-medium">+{validPhone}</span>
                    <span className="text-muted-foreground">{t("resolved")}</span>
                  </p>
                ) : (
                  <p
                    className={cn(
                      "text-xs",
                      // Only scolds once there is enough typed to be wrong.
                      // Turning red on the first keystroke is noise, not help.
                      parsed.invalid > 0 && phone.trim().length > 5
                        ? "text-warning-ink"
                        : "text-muted-foreground",
                    )}
                  >
                    {parsed.invalid > 0 && phone.trim().length > 5
                      ? t("phoneInvalid")
                      : t("phoneHint")}
                  </p>
                )}
              </div>

              <ElevatedInput
                label={t("nameLabel")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full"
              />

              {/* The channel's central risk, stated where the action is taken
                  rather than only on the settings page nobody reopens. */}
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted p-3">
                <Warning className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
                <p className="text-xs leading-relaxed text-muted-foreground">{t("risk")}</p>
              </div>

              {error && (
                <p className="rounded-[--radius] bg-muted px-3 py-2 text-sm text-destructive-ink">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <ElevatedDialogFooter>
          <Button
            variant="secondary"
            title={t("cancel")}
            onClick={() => onOpenChange(false)}
            disabled={busy}
          />
          {instances.length > 0 && (
            <Button
              variant="primary"
              title={busy ? t("opening") : t("submit")}
              onClick={() => void submit()}
              disabled={!canSubmit}
            />
          )}
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
