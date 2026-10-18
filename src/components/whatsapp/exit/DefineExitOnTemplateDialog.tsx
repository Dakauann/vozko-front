"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import { CircuitRoutes } from "@/components/elevated-design/circuit-routes";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  EXIT_KINDS,
  changeOf,
  offeredKinds,
  withButtonAction,
  type ButtonActionChoice,
  type TemplateActionsChange,
  type TemplateButtonActions,
} from "@/lib/whatsapp-templates/exit";

import { ButtonActionFields } from "./ButtonActionFields";
import { FIELD_ANCHOR, QuickReplyChip, RouteCard } from "./ButtonRoutePieces";
import { useButtonActionLabel } from "./use-button-action-label";
import { useTemplateButtonActions } from "./use-template-exit";

interface DefineExitOnTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
}

function changeFor(stored: TemplateButtonActions, button: string, action: ButtonActionChoice | null): TemplateActionsChange | null {
  if (button === "" || !action) return null;
  const index = Number(button);
  const shown = stored.buttons.find((candidate) => candidate.index === index)?.text ?? "";
  return withButtonAction(changeOf(stored), index, shown, action);
}

function NoQuickReplies({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const t = useTranslations("templateExit");
  return (
    <>
      <ElevatedDialogBody>
        <Notice tone="info">
          <p>{t("define.noButtons")}</p>
        </Notice>
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="secondary" title={t("choice.cancel")} onClick={onClose} />
        <Button type="button" variant="primary" title={t("campaign.editTemplate")} link={`/dashboard/whatsapp-templates/${templateId}`} />
      </ElevatedDialogFooter>
    </>
  );
}

function DefineExitForm({
  stored,
  onSave,
  onClose,
  onProblem,
}: {
  stored: TemplateButtonActions;
  onSave: ReturnType<typeof useTemplateButtonActions>["save"];
  onClose: () => void;
  onProblem: (problem: string | null) => void;
}) {
  const t = useTranslations("templateExit");
  const [button, setButton] = useState("");
  const [action, setAction] = useState<ButtonActionChoice | null>(null);
  const [saving, setSaving] = useState(false);
  const change = changeFor(stored, button, action);
  const labelOf = useButtonActionLabel();
  const chosenText = stored.buttons.find((candidate) => String(candidate.index) === button)?.text ?? "";

  const save = async () => {
    if (!change) return;
    setSaving(true);
    onProblem(null);
    try {
      const result = await onSave(change);
      if (result.status === "saved") {
        toast.success(t("define.saved"));
        onClose();
      }
      if (result.status === "conflict") onProblem(t("panel.conflict"));
      if (result.status === "failed") onProblem(codedErrorMessage(t, { code: result.error.code }, t("panel.failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ElevatedDialogBody className="space-y-3">
        <p className="text-sm text-foreground">{t("define.pickButton")}</p>
        <ElevatedSelect label={t("define.button")} aria-label={t("define.button")} value={button} onValueChange={setButton} contentClassName="z-[200]">
          {stored.buttons.map((candidate) => (
            <ElevatedSelectItem key={candidate.index} value={String(candidate.index)}>
              {candidate.text}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <CircuitRoutes
          label={t("define.button")}
          routes={[
            {
              key: "chosen",
              name: chosenText ? t("campaign.destination", { text: chosenText, action: labelOf(action) }) : t("define.button"),
              state: chosenText && action ? "linked" : "open",
              targetAnchor: FIELD_ANCHOR,
              source: <QuickReplyChip text={chosenText || t("define.button")} />,
              target: (
                <RouteCard>
                  <ButtonActionFields value={action} kinds={offeredKinds(EXIT_KINDS, stored.allowedKinds)} allowNone={false} onChange={setAction} />
                </RouteCard>
              ),
            },
          ]}
        />
        <Notice tone="info">
          <p>{t("define.note")}</p>
        </Notice>
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="secondary" title={t("choice.cancel")} onClick={onClose} disabled={saving} />
        <Button type="button" variant="primary" title={t("define.save")} disabled={!change || saving} onClick={() => void save()} />
      </ElevatedDialogFooter>
    </>
  );
}

function DefineExitBody({ templateId, templateName, onOpenChange }: Omit<DefineExitOnTemplateDialogProps, "open">) {
  const t = useTranslations("templateExit");
  const exit = useTemplateButtonActions(templateId);
  const [problem, setProblem] = useState<string | null>(null);
  const close = () => onOpenChange(false);
  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("define.title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("define.description", { name: templateName })}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      {exit.loading ? <p className="text-xs text-muted-foreground">{t("verdict.loading")}</p> : null}
      {exit.error ? (
        <p role="alert" className="text-xs text-destructive-ink">
          {codedErrorMessage(t, exit.error, t("panel.loadFailed"))}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-xs text-destructive-ink">
          {problem}
        </p>
      ) : null}
      {exit.actions && exit.actions.buttons.length === 0 ? <NoQuickReplies templateId={templateId} onClose={close} /> : null}
      {exit.actions && exit.actions.buttons.length > 0 ? (
        <DefineExitForm key={exit.actions.version} stored={exit.actions} onSave={exit.save} onClose={close} onProblem={setProblem} />
      ) : null}
    </>
  );
}

export function DefineExitOnTemplateDialog({ open, ...props }: DefineExitOnTemplateDialogProps) {
  return (
    <ElevatedDialog open={open} onOpenChange={props.onOpenChange}>
      <ElevatedDialogContent className="max-w-[560px]">{open ? <DefineExitBody {...props} /> : null}</ElevatedDialogContent>
    </ElevatedDialog>
  );
}
