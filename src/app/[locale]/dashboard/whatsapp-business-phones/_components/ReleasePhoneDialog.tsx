"use client";

import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Trash,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { releaseBusinessPhoneAction } from "@/app/actions/whatsapp-business-phones";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface ReleasePhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneId: string;
  /** Display number used for the typed confirmation guard. */
  phoneNumber: string;
  /** WABA id — the confirmation fallback when a failed/unsynced number has no
   *  display number, so the phone can still be removed. */
  wabaId?: string;
  /** Friendly label shown in the warning copy. */
  phoneName: string;
  onSuccess: () => void;
}

interface ReleaseResult {
  deregistered: boolean;
  webhooksRemoved: boolean;
  tokenCleared: boolean;
  phoneDeleted: boolean;
  wabaCleanedUp: boolean;
  deregisterError?: string;
  webhooksError?: string;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function ReleasePhoneDialog({
  open,
  onOpenChange,
  phoneId,
  phoneNumber,
  wabaId,
  phoneName,
  onSuccess,
}: ReleasePhoneDialogProps) {
  const t = useTranslations("whatsappBusinessPhones");
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [result, setResult] = useState<ReleaseResult | null>(null);

  // Confirm against the display number, or the WABA id when a failed/unsynced number
  // has none — otherwise the button could never enable and the phone never removed.
  const confirmTarget = (phoneNumber?.trim() || wabaId?.trim()) ?? "";
  const targetDigits = onlyDigits(confirmTarget);
  const confirmed =
    targetDigits.length > 0 && onlyDigits(confirmValue) === targetDigits;

  const handleRelease = async () => {
    if (!confirmed) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await releaseBusinessPhoneAction(phoneId, confirmValue);

      if (response.error) {
        toast({
          title: t("release.errorTitle"),
          description: response.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (response.data?.result) {
        setResult(response.data.result);
      }

      toast({
        title: t("release.successTitle"),
        description: t("release.successDesc"),
      });

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1800);
    } catch {
      toast({
        title: t("release.errorTitle"),
        description: t("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setResult(null);
      setConfirmValue("");
      onOpenChange(false);
    }
  };

  const StepIcon = ({ success }: { success: boolean }) =>
    success ? (
      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" weight="fill" />
    ) : (
      <XCircle className="h-4 w-4 shrink-0 text-red-500" weight="fill" />
    );

  return (
    <ElevatedDialog open={open} onOpenChange={handleClose}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("release.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {t("release.description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="space-y-5 py-4">
          {!result && (
            <>
              <div className="flex items-start gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <Warning
                  className="mt-0.5 h-7 w-7 shrink-0 text-destructive"
                  weight="fill"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {t("release.warning")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("release.warningMessage", { name: phoneName })}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("release.stepsTitle")}
                </p>
                <ol className="space-y-2.5 text-sm text-muted-foreground">
                  {["step1", "step2", "step3", "step4"].map((key, idx) => (
                    <li key={key} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                        {idx + 1}
                      </span>
                      <span>{t(`release.${key}`)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <ArrowSquareOut className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("release.metaNote")}
                </p>
              </div>

              {/* Typed confirmation, the backend re-checks this too. */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {t("release.confirmLabel", { number: confirmTarget })}
                </label>
                <ElevatedInput
                  type="text"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder={confirmTarget}
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value)}
                  className="font-mono"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("release.resultTitle")}
              </p>
              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2.5">
                  <StepIcon success={result.deregistered} />
                  <span className="text-sm text-foreground">
                    {t("release.resultDeregistered")}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <StepIcon success={result.webhooksRemoved} />
                  <span className="text-sm text-foreground">
                    {t("release.resultWebhooks")}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <StepIcon success={result.tokenCleared} />
                  <span className="text-sm text-foreground">
                    {t("release.resultToken")}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <StepIcon success={result.phoneDeleted} />
                  <span className="text-sm text-foreground">
                    {t("release.resultDeleted")}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <StepIcon success={result.wabaCleanedUp} />
                  <span className="text-sm text-foreground">
                    {t("release.resultWaba")}
                  </span>
                </div>

                {(result.deregisterError || result.webhooksError) && (
                  <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {result.deregisterError && (
                      <p className="text-xs text-amber-600">
                        {t("release.partialWarning")}: {result.deregisterError}
                      </p>
                    )}
                    {result.webhooksError && (
                      <p className="text-xs text-amber-600">
                        {t("release.partialWarning")}: {result.webhooksError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {!result ? (
              <>
                <Button
                  variant="ghost"
                  title={t("button.cancel")}
                  onClick={handleClose}
                  disabled={loading}
                />
                <Button
                  variant="primary"
                  title={
                    loading ? t("release.releasing") : t("release.confirmButton")
                  }
                  icon={
                    loading ? (
                      <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                    ) : (
                      <Trash className="h-4 w-4" weight="bold" />
                    )
                  }
                  iconVisible
                  iconSide="left"
                  onClick={handleRelease}
                  disabled={loading || !confirmed}
                  className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
                />
              </>
            ) : (
              <Button
                variant="primary"
                title={t("release.done")}
                onClick={() => {
                  onSuccess();
                  handleClose();
                }}
              />
            )}
          </div>
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
