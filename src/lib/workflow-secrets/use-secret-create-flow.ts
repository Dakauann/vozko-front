"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { putWorkflowSecretAction } from "@/app/actions/workflow-secrets";
import { codedErrorMessage } from "@/lib/api/coded-error";

import { secretCreateBlock, secretFieldOfCode, type SecretField, type SecretNameList } from "./secret-create";
import type { WorkflowSecret } from "./types";

export interface SecretFieldError {
  field: SecretField;
  message: string;
}

export interface SecretSaved {
  secret: WorkflowSecret | null;
}

export function useSecretCreateFlow(list: SecretNameList, shownFields: readonly SecretField[]) {
  const t = useTranslations("workflowSecretsPage");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<SecretFieldError | null>(null);

  const put = async (name: string, value: string): Promise<SecretSaved | null> => {
    if (saving) return null;
    setSaving(true);
    setFieldError(null);
    const result = await putWorkflowSecretAction(name, value);
    setSaving(false);
    if (result.error) {
      const field = secretFieldOfCode(result.code);
      const message = codedErrorMessage(t, result, result.error);
      if (field && shownFields.includes(field)) setFieldError({ field, message });
      else toast.error(t("toast.failed"), { description: message });
      return null;
    }
    return { secret: result.secret };
  };

  return {
    saving,
    fieldError,
    clearFieldError: () => setFieldError(null),
    blockOf: (name: string) => secretCreateBlock(name, list),
    create: (name: string, value: string) => (secretCreateBlock(name, list) ? Promise.resolve(null) : put(name, value)),
    replace: put,
  };
}
