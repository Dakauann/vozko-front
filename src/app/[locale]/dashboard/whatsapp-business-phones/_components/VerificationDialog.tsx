"use client";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { PaperPlaneRight, ShieldCheck, Spinner } from "@/components/icons";
import {
  requestVerificationCodeAction,
  verifyPhoneCodeAction,
} from "@/app/actions/whatsapp-business-phones";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface VerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneId: string;
  phoneNumber: string;
  onSuccess: () => void;
}

type VerificationStep = "request" | "verify";
type CodeMethod = "SMS" | "VOICE";

export function VerificationDialog({
  open,
  onOpenChange,
  phoneId,
  phoneNumber,
  onSuccess,
}: VerificationDialogProps) {
  const t = useTranslations("whatsappBusinessPhones");
  const { toast } = useToast();

  const [step, setStep] = useState<VerificationStep>("request");
  const [codeMethod, setCodeMethod] = useState<CodeMethod>("SMS");
  const [language, setLanguage] = useState("pt_BR");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    setLoading(true);
    try {
      const result = await requestVerificationCodeAction(phoneId, {
        method: codeMethod,
        language,
      });

      if (!result.error) {
        toast({
          title: t("toast.codeSent"),
          description: t("toast.codeSentDesc", { method: codeMethod }),
        });
        setStep("verify");
      } else {
        toast({
          title: t("toast.codeRequestFailed"),
          description: result.error || t("toast.unknownError"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("toast.codeRequestFailed"),
        description: t("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      toast({
        title: t("toast.enterCode"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await verifyPhoneCodeAction(phoneId, {
        code: verificationCode,
      });

      if (!result.error) {
        toast({
          title: t("toast.phoneVerified"),
          description: t("toast.phoneVerifiedDesc"),
        });
        onSuccess();
        handleClose();
      } else {
        toast({
          title: t("toast.verificationFailed"),
          description: result.error || t("toast.unknownError"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("toast.verificationFailed"),
        description: t("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("request");
    setCodeMethod("SMS");
    setVerificationCode("");
    onOpenChange(false);
  };

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("verification.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {t("verification.description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <ShieldCheck className="w-8 h-8 text-primary-ink" weight="fill" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("verification.verifyingNumber")}
              </p>
              <p className="text-sm text-muted-foreground">
                {phoneNumber}
              </p>
            </div>
          </div>

          {step === "request" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("verification.selectMethod")}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCodeMethod("SMS")}
                  className={`p-4 rounded-lg border transition-all ${
                    codeMethod === "SMS"
                      ? "border-primary bg-muted"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {t("verification.sms")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("verification.smsDesc")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeMethod("VOICE")}
                  className={`p-4 rounded-lg border transition-all ${
                    codeMethod === "VOICE"
                      ? "border-primary bg-muted"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {t("verification.voice")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("verification.voiceDesc")}
                  </span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("verification.language")}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                >
                  <option value="pt_BR">Português (Brasil)</option>
                  <option value="en_US">English (US)</option>
                  <option value="es">Español</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  title={t("button.cancel")}
                  onClick={handleClose}
                />
                <Button
                  variant="primary"
                  title={
                    loading
                      ? t("verification.requesting")
                      : t("verification.requestCode")
                  }
                  icon={
                    loading ? (
                      <Spinner className="w-4 h-4 animate-spin" />
                    ) : (
                      <PaperPlaneRight className="w-4 h-4" />
                    )
                  }
                  iconVisible
                  iconSide="left"
                  onClick={handleRequestCode}
                  disabled={loading}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("verification.enterCode")}
              </p>

              <ElevatedInput
                label={t("verification.codeLabel")}
                placeholder={t("verification.codePlaceholder")}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ""))
                }
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  title={t("verification.resendCode")}
                  onClick={() => setStep("request")}
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    title={t("button.cancel")}
                    onClick={handleClose}
                  />
                  <Button
                    variant="primary"
                    title={
                      loading
                        ? t("verification.verifying")
                        : t("verification.verify")
                    }
                    icon={
                      loading ? (
                        <Spinner className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )
                    }
                    iconVisible
                    iconSide="left"
                    onClick={handleVerifyCode}
                    disabled={loading || verificationCode.length !== 6}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
