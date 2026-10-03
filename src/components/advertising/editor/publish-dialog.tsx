"use client";

import { useTranslations } from "next-intl";

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
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { PaperPlaneTilt } from "@/components/icons";
import type { EditorNode } from "@/lib/advertising/editor-tree";
import type { JobPlan, PublishBlocker, ValidationState } from "@/lib/advertising/publish";
import type { AdPublishJob } from "@/lib/advertising/types";

import { useAdsErrorText, type AdsErrorLike } from "../use-ads-error";
import { FeeSummary, IssueLinks, PublishBlockers, PublishNotes, type BlockerReadiness } from "../wizard/publish-check";
import { PublishProgress } from "../wizard/publish-progress";

export interface PublishJobView {
  job: AdPublishJob;
  plan: JobPlan;
  pollError: string | null;
  onRetryPoll: () => void;
  onBackToDraft: () => void;
  onOpenJobs: () => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  validation,
  blockers,
  ads,
  keepPaused,
  onKeepPaused,
  onRevalidate,
  onGoTo,
  onPublish,
  publishing,
  publishError,
  saveError,
  jobView,
  readiness,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: ValidationState;
  blockers: PublishBlocker[];
  ads: number;
  keepPaused: boolean;
  onKeepPaused: (keepPaused: boolean) => void;
  onRevalidate: () => void;
  onGoTo: (node: EditorNode) => void;
  onPublish: () => void;
  publishing: boolean;
  publishError: AdsErrorLike | null;
  saveError: string | null;
  jobView: PublishJobView | null;
  readiness: BlockerReadiness;
}) {
  const t = useTranslations("adsEditor.publish");
  const tWizard = useTranslations("adsWizard");
  const tReview = useTranslations("adsWizard.review");
  const errorText = useAdsErrorText();
  const fee = blockers.length === 0 && validation.status === "done" ? validation.fee : null;

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-4">
          {jobView ? (
            <PublishProgress {...jobView} />
          ) : (
            <>
              {saveError ? <p className="text-sm text-destructive-ink">{t("saveFailed", { message: saveError })}</p> : null}
              <PublishBlockers blockers={blockers} validation={validation} onRevalidate={onRevalidate} readiness={readiness} />
              {validation.status === "done" ? <IssueLinks issues={validation.issues} onGoTo={onGoTo} /> : null}
              {fee ? <FeeSummary fee={fee} ads={ads} /> : null}
              <ElevatedSwitch
                checked={keepPaused}
                onCheckedChange={onKeepPaused}
                label={tReview("keepPaused")}
                description={tReview("keepPausedHint")}
              />
              <PublishNotes />
              {publishError ? <p className="text-sm text-destructive-ink">{errorText(publishError)}</p> : null}
            </>
          )}
        </ElevatedDialogBody>
        {jobView ? null : (
          <ElevatedDialogFooter>
            <Button variant="secondary" title={tWizard("cancel")} onClick={() => onOpenChange(false)} />
            <Button
              variant="primary"
              title={publishing ? tWizard("publishing") : keepPaused ? tWizard("publishPaused") : tWizard("publish")}
              icon={<PaperPlaneTilt className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              disabled={publishing || blockers.length > 0}
              onClick={onPublish}
            />
          </ElevatedDialogFooter>
        )}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
