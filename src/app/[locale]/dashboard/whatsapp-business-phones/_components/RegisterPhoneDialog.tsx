"use client";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Lightning, Spinner, Warning } from "@phosphor-icons/react";
import { registerBusinessPhoneAction } from "@/app/actions/whatsapp-business-phones";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface RegisterPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneId: string;
  phoneNumber: string;
  onSuccess: () => void;
}

export function RegisterPhoneDialog({
  open,
  onOpenChange,
  phoneId,
  phoneNumber,
  onSuccess,
}: RegisterPhoneDialogProps) {
  const t = useTranslations("whatsappBusinessPhones");
  const { toast } = useToast();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (pin.length !== 6) {
      toast({
        title: t("cloudRegistration.pinRequired"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await registerBusinessPhoneAction(phoneId, { pin });

      if (!result.error) {
        toast({
          title: t("cloudRegistration.success"),
          description: t("cloudRegistration.successDesc"),
        });
        onSuccess();
        handleClose();
      } else {
        toast({
          title: t("cloudRegistration.error"),
          description: result.error || t("toast.unknownError"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("cloudRegistration.error"),
        description: t("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPin("");
    onOpenChange(false);
  };

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>
            {t("cloudRegistration.title")}
          </ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {t("cloudRegistration.description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
            <Lightning
              className="w-8 h-8 text-emerald-500"
              weight="fill"
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("cloudRegistration.registeringNumber")}
              </p>
              <p className="text-sm text-muted-foreground">
                {phoneNumber}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-500/10 dark:bg-amber-900/20 rounded-lg">
            <Warning
              className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
              weight="fill"
            />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("cloudRegistration.rateLimitWarning")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("cloudRegistration.pinInstructions")}
            </p>

            <ElevatedInput
              label={t("cloudRegistration.pinLabel")}
              placeholder={t("cloudRegistration.pinPlaceholder")}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, ""))
              }
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
            />

            <p className="text-xs text-muted-foreground">
              {t("cloudRegistration.pinHint")}
            </p>
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
                  ? t("cloudRegistration.registering")
                  : t("cloudRegistration.registerButton")
              }
              icon={
                loading ? (
                  <Spinner className="w-4 h-4 animate-spin" />
                ) : (
                  <Lightning className="w-4 h-4" />
                )
              }
              iconVisible
              iconSide="left"
              onClick={handleRegister}
              disabled={loading || pin.length !== 6}
            />
          </div>
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
