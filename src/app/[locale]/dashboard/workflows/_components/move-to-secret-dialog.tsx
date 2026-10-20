"use client";

import { useMemo, useState } from "react";
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
import type { SecretNameList } from "@/lib/workflow-secrets/secret-create";
import { secretUsageSnippets } from "@/lib/workflow-secrets/secret-name";
import { useSecretCreateFlow } from "@/lib/workflow-secrets/use-secret-create-flow";
import { useWorkflowSecretNames } from "@/lib/workflow-secrets/use-workflow-secret-names";
import type { PlainSecretFix } from "@/lib/workflows/plain-secret";

const SHOWN_FIELDS = ["name"] as const;

export interface MoveToSecretRequest {
  nodeId: string;
  nodeLabel: string;
  inCode: boolean;
  fix: PlainSecretFix;
}

export function MoveToSecretDialog({
  request,
  onClose,
  onMoved,
}: {
  request: MoveToSecretRequest;
  onClose: () => void;
  onMoved: (nodeId: string, config: Record<string, unknown>) => void;
}) {
  const t = useTranslations("workflowSecretsPage");
  const known = useWorkflowSecretNames();
  const existing = useMemo<SecretNameList>(
    () => ({ names: new Set(known.names), loading: known.loading, failed: known.failed }),
    [known],
  );
  const [name, setName] = useState(request.fix.suggestedName);
  const flow = useSecretCreateFlow(existing, SHOWN_FIELDS);
  const block = flow.blockOf(name);

  const nameError =
    block === "invalid"
      ? t("dialog.nameInvalid")
      : block === "taken"
        ? t("move.nameTaken")
        : flow.fieldError?.message;
  const ready = block === null;
  const snippets = secretUsageSnippets(name || "nome");

  const submit = async () => {
    if (!ready) return;
    const saved = await flow.create(name, request.fix.value);
    if (!saved) return;
    onMoved(request.nodeId, request.fix.replace(name));
    toast(t("move.done"), { description: t("move.saveReminder") });
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !flow.saving && onClose()}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("move.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("move.description", { node: request.nodeLabel })}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("move.valueNote", { count: request.fix.value.length })}{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs text-foreground">
                {request.inCode ? snippets.code : snippets.template}
              </code>
            </p>
            {known.failed && <p className="text-xs text-destructive-ink">{t("move.listFailed")}</p>}
            <button type="submit" hidden aria-hidden tabIndex={-1} />
          </form>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("dialog.cancel")} onClick={onClose} disabled={flow.saving} />
          <Button variant="primary" title={t("move.confirm")} onClick={() => void submit()} disabled={flow.saving || !ready} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
