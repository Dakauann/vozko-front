"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { saveStudioProjectAction } from "@/app/actions/studio";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { WarningCircle } from "@/components/icons";
import { STUDIO_LIMITS } from "@/lib/studio/document";
import { summaryOf, type StudioProjectSummary } from "@/lib/studio/project";
import { projectNameIssue } from "@/lib/studio/validate";

interface RenameProjectDialogProps {
  project: StudioProjectSummary | null;
  onClose: () => void;
  onRenamed: (project: StudioProjectSummary) => void;
}

function RenameForm({ project, onClose, onRenamed }: { project: StudioProjectSummary; onClose: () => void; onRenamed: (project: StudioProjectSummary) => void }) {
  const t = useTranslations("studio");
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issue = projectNameIssue(name);
  const nameError = issue ? (issue.code === "required" ? t("issues.nameRequired") : t("issues.nameTooLarge", { max: STUDIO_LIMITS.maxProjectNameRunes })) : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || issue) return;
    setSaving(true);
    setError(null);
    const first = await saveStudioProjectAction(project.id, project.version, { name });
    const result = first.status === "conflict" ? await saveStudioProjectAction(project.id, first.current.version, { name }) : first;
    setSaving(false);
    if (result.status === "saved") onRenamed(summaryOf(result.project));
    else setError(result.status === "failed" ? result.error.error : t("rename.failed"));
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("rename.title")}</ElevatedDialogTitle>
      </ElevatedDialogHeader>
      <ElevatedDialogBody className="space-y-3">
        <ElevatedInput label={t("rename.name")} value={name} onChange={(e) => setName(e.target.value)} error={nameError} controlSize="sm" autoFocus />
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive-ink">
            <WarningCircle className="h-4 w-4 shrink-0" aria-hidden />
            {t("rename.failed")} {error}
          </p>
        ) : null}
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="ghost" title={t("rename.cancel")} onClick={onClose} disabled={saving} />
        <Button type="submit" variant="primary" title={saving ? t("rename.saving") : t("rename.save")} disabled={saving || Boolean(issue)} />
      </ElevatedDialogFooter>
    </form>
  );
}

export function RenameProjectDialog({ project, onClose, onRenamed }: RenameProjectDialogProps) {
  return (
    <ElevatedDialog open={project !== null} onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-md">{project ? <RenameForm key={project.id} project={project} onClose={onClose} onRenamed={onRenamed} /> : null}</ElevatedDialogContent>
    </ElevatedDialog>
  );
}
