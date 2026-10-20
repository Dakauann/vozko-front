"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { isValidSecretName } from "@/lib/workflow-secrets/secret-name";
import type { SecretNameList } from "@/lib/workflow-secrets/secret-create";
import type { WorkflowSecret } from "@/lib/workflow-secrets/types";
import { useSecretCreateFlow } from "@/lib/workflow-secrets/use-secret-create-flow";

export type WorkflowSecretDialogMode = { kind: "create" } | { kind: "replace"; name: string };

const SHOWN_FIELDS = ["name", "value"] as const;

export function WorkflowSecretDialog({
  mode,
  existing,
  onClose,
  onSaved,
}: {
  mode: WorkflowSecretDialogMode;
  existing: SecretNameList;
  onClose: () => void;
  onSaved: (secret: WorkflowSecret | null) => void;
}) {
  const t = useTranslations("workflowSecretsPage");
  const replacing = mode.kind === "replace";
  const [name, setName] = useState(replacing ? mode.name : "");
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const flow = useSecretCreateFlow(existing, SHOWN_FIELDS);
  const block = replacing ? (isValidSecretName(name) ? null : "invalid") : flow.blockOf(name);

  const nameError = (() => {
    if (replacing) return undefined;
    if ((name !== "" || submitted) && block === "invalid") return t("dialog.nameInvalid");
    if (block === "taken") return t("dialog.nameTaken");
    return flow.fieldError?.field === "name" ? flow.fieldError.message : undefined;
  })();
  const valueError = (() => {
    if (submitted && value === "") return t("dialog.valueRequired");
    return flow.fieldError?.field === "value" ? flow.fieldError.message : undefined;
  })();
  const ready = block === null && value !== "";

  const submit = async () => {
    setSubmitted(true);
    if (!ready) return;
    const saved = replacing ? await flow.replace(name, value) : await flow.create(name, value);
    if (!saved) return;
    toast(replacing ? t("toast.replaced") : t("toast.created"));
    onSaved(saved.secret);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !flow.saving && onClose()}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>
            {replacing ? t("dialog.replaceTitle", { name: mode.name }) : t("dialog.createTitle")}
          </ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {replacing ? t("dialog.replaceNotice") : t("dialog.writeOnly")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {replacing ? null : (
              <div className="space-y-1.5">
                <ElevatedInput
                  label={t("dialog.name")}
                  placeholder=" "
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    flow.clearFieldError();
                  }}
                  error={nameError}
                  autoComplete="off"
                  spellCheck={false}
                  inputClassName="font-mono"
                  autoFocus
                />
                {nameError ? null : <p className="text-xs text-muted-foreground">{t("dialog.nameHint")}</p>}
              </div>
            )}
            <ElevatedInput
              label={t("dialog.value")}
              placeholder=" "
              type="password"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                flow.clearFieldError();
              }}
              error={valueError}
              autoComplete="new-password"
              autoFocus={replacing}
            />
            {!replacing && existing.failed && <p className="text-xs text-destructive-ink">{t("move.listFailed")}</p>}
            <button type="submit" hidden aria-hidden tabIndex={-1} />
          </form>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("dialog.cancel")} onClick={onClose} disabled={flow.saving} />
          <Button
            variant="primary"
            title={replacing ? t("dialog.replace") : t("dialog.save")}
            onClick={() => void submit()}
            disabled={flow.saving || (submitted && !ready)}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
