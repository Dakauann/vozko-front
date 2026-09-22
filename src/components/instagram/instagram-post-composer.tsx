"use client";

import {
  ChartLineUp,
  FilmSlate,
  ImageSquare,
  Info,
  PlayCircle,
  Sparkle,
  UploadSimple,
  Warning,
} from "@/components/icons";
import { useEffect, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import Textarea from "@/components/elevated-design/elevated-textarea";
import { uploadMediaAction } from "@/app/actions/medias";

import {
  CommentRuleFields,
  commentRuleFieldsErrors,
  type CommentRuleFieldsValue,
} from "./comment-rule-fields";
import type { CommentRulePayload, InstagramMedia } from "@/lib/instagram/types";
import { createCommentRuleAction, createInstagramMediaAction } from "@/app/actions/instagram";
import {
  getCommentAnalysisSettingsAction,
  putCommentContainerSettingsAction,
} from "@/app/actions/audience";
import type { CommentAnalysisSettings } from "@/lib/audience/types";
import type { OverrideDraft } from "@/lib/audience/override";
import { overrideDraftFrom, overrideDraftToPut } from "@/lib/audience/override";
import { OverrideFields } from "@/components/audience/override-fields";
import { useWorkspace } from "@/contexts/workspace-context";
import { useTranslations } from "next-intl";


type PostKind = "feed" | "reels" | "stories";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function InstagramPostComposer({
  accountId,
  onClose,
  onPublished,
}: {
  accountId: string;
  onClose: () => void;
  onPublished: (media: InstagramMedia) => void;
}) {
  const t = useTranslations("instagram.composer");
  const { can } = useWorkspace();
  const canConfigureAnalysis = can("audience", "update");

  const [kind, setKind] = useState<PostKind>("feed");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");

  const [withRule, setWithRule] = useState(false);
  const [ruleFields, setRuleFields] = useState<CommentRuleFieldsValue>({
    match: "contains",
    keywords: "",
    actions: ["private_reply"],
    publicText: "",
    privateText: "",
  });

  const [withAnalysis, setWithAnalysis] = useState(false);
  const [accountAnalysis, setAccountAnalysis] = useState<CommentAnalysisSettings | null>(null);
  const [analysisDraft, setAnalysisDraft] = useState<OverrideDraft | null>(null);
  useEffect(() => {
    if (!withAnalysis || accountAnalysis) return;
    let cancelled = false;
    void getCommentAnalysisSettingsAction("instagram", accountId).then((res) => {
      if (cancelled || !res.settings) return;
      setAccountAnalysis(res.settings);
      setAnalysisDraft(overrideDraftFrom({ override: null, effective: res.settings }));
    });
    return () => {
      cancelled = true;
    };
  }, [withAnalysis, accountAnalysis, accountId]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ruleWarning, setRuleWarning] = useState<string | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);

  const isVideo = kind !== "feed";

  const ruleErrors = commentRuleFieldsErrors(ruleFields);
  const invalid = !mediaUrl.trim() || (withRule && !ruleErrors.valid);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }

    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("media", file);
    form.append("mediaType", isVideo ? "video" : "image");
    form.append("description", file.name || t("title"));

    const result = await uploadMediaAction(form);

    setUploading(false);
    if (result.error || !result.mediaUrl) {
      setError(result.error ?? t("uploadFailed"));
      return;
    }
    setMediaUrl(result.mediaUrl);
  };

  const handlePublish = async () => {
    if (invalid || publishing) return;
    setPublishing(true);
    setError(null);
    setRuleWarning(null);
    setAnalysisWarning(null);

    const result = await createInstagramMediaAction(accountId, {
      imageUrl: isVideo ? undefined : mediaUrl.trim(),
      videoUrl: isVideo ? mediaUrl.trim() : undefined,
      caption: caption.trim() || undefined,
      mediaType: kind === "reels" ? "REELS" : kind === "stories" ? "STORIES" : undefined,
    });

    if (result.error || !result.media) {
      setPublishing(false);
      setError(result.error ?? t("publishFailed"));
      return;
    }

    if (withRule) {
      const rule: CommentRulePayload = {
        name: t("ruleName"),
        enabled: true,
        igMediaId: result.media.id,
        match: ruleFields.match,
        keywords: ruleErrors.keywordList,
        actions: ruleFields.actions,
        publicReplyText: ruleFields.publicText.trim(),
        privateReplyText: ruleFields.privateText.trim(),
      };
      const ruleResult = await createCommentRuleAction(accountId, rule);
      if (ruleResult.error) {
        setPublishing(false);
        setRuleWarning(ruleResult.error);
        return;
      }
    }

    if (withAnalysis && analysisDraft) {
      const put = overrideDraftToPut(analysisDraft);
      const analysisResult = await putCommentContainerSettingsAction("instagram", accountId, result.media.id, put);
      if (analysisResult.error) {
        setPublishing(false);
        setAnalysisWarning(analysisResult.error);
        return;
      }
    }

    setPublishing(false);
    onPublished(result.media);
  };

  const kinds: { id: PostKind; label: string; icon: typeof ImageSquare }[] = [
    { id: "feed", label: t("kindFeed"), icon: ImageSquare },
    { id: "reels", label: t("kindReels"), icon: FilmSlate },
    { id: "stories", label: t("kindStories"), icon: PlayCircle },
  ];

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && !publishing && onClose()}>
      <ElevatedDialogContent className="flex max-h-[min(88vh,760px)] w-full max-w-lg flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>

        {ruleWarning || analysisWarning ? (
          <div className="space-y-4 p-5">
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-warning-ink dark:text-warning-ink">
              <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
              {ruleWarning ? t("publishedButRuleFailed", { error: ruleWarning }) : t("publishedButAnalysisFailed", { error: analysisWarning ?? "" })}
            </p>
            <Button title={t("done")} variant="primary" className="w-full" onClick={onClose} />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-sleek">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("kind")}</label>
                <ElevatedSegmentedControl
                  value={kind}
                  onChange={(v) => setKind(v as PostKind)}
                  disabled={publishing}
                  options={kinds.map(({ id, label, icon: Icon }) => ({
                    value: id,
                    label,
                    icon: <Icon className="h-3.5 w-3.5" weight="fill" />,
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {isVideo ? t("videoUrl") : t("imageUrl")}
                </label>
                <div className="flex items-center gap-2">
                  <ElevatedInput
                    autoFocus
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    disabled={publishing || uploading}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <Button
                    title={uploading ? t("uploading") : t("upload")}
                    variant="outline"
                    icon={<UploadSimple className="h-3.5 w-3.5" />}
                    disabled={publishing || uploading}
                    onClick={() => fileRef.current?.click()}
                  />
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept={isVideo ? "video/mp4,video/quicktime" : "image/jpeg"}
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
                {
}
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  {isVideo ? t("videoHint") : t("imageHint")}
                </p>
              </div>

              {kind !== "stories" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("caption")}</label>
                  <Textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={publishing}
                    rows={3}
                    placeholder={t("captionPlaceholder")}
                    className="resize-y"
                  />
                  {
}
                  <p className="flex items-start gap-1.5 text-xs text-warning-ink">
                    <Warning className="mt-0.5 h-3 w-3 shrink-0" />
                    {t("captionImmutable")}
                  </p>
                </div>
              )}

              <div className="rounded-[--radius] border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Sparkle className="h-3.5 w-3.5 text-primary-ink" weight="fill" />
                      {t("ruleTitle")}
                    </span>
                    <p className="text-xs text-muted-foreground">{t("ruleHint")}</p>
                  </div>
                  <ElevatedSwitch
                    checked={withRule}
                    onCheckedChange={setWithRule}
                    disabled={publishing}
                    aria-label={t("ruleTitle")}
                  />
                </div>

                {withRule && (
                  <div className="mt-4 border-t border-border pt-4">
                    <CommentRuleFields
                      value={ruleFields}
                      onChange={setRuleFields}
                      disabled={publishing}
                    />
                  </div>
                )}
              </div>

              {canConfigureAnalysis && (
                <div className="rounded-[--radius] border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <ChartLineUp className="h-3.5 w-3.5 text-primary-ink" weight="fill" />
                        {t("analysisTitle")}
                      </span>
                      <p className="text-xs text-muted-foreground">{t("analysisHint")}</p>
                    </div>
                    <ElevatedSwitch
                      checked={withAnalysis}
                      onCheckedChange={setWithAnalysis}
                      disabled={publishing}
                      aria-label={t("analysisTitle")}
                    />
                  </div>

                  {withAnalysis && (
                    <div className="mt-4 border-t border-border pt-4">
                      {accountAnalysis && analysisDraft ? (
                        <>
                          {!accountAnalysis.enabled && (
                            <p className="mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Info className="mt-0.5 h-3 w-3 shrink-0" />
                              {t("analysisAccountOff")}
                            </p>
                          )}
                          <OverrideFields id="composer" draft={analysisDraft} onChange={setAnalysisDraft} effective={accountAnalysis} disabled={publishing} />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("analysisLoading")}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-destructive-ink">
                  <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">
                {publishing ? t("publishingHint") : t("quotaHint")}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  title={t("cancel")}
                  variant="ghost"
                  disabled={publishing}
                  onClick={onClose}
                />
                <Button
                  title={publishing ? t("publishing") : t("publish")}
                  variant="primary"
                  disabled={invalid || publishing || uploading}
                  onClick={() => void handlePublish()}
                />
              </div>
            </ElevatedDialogFooter>
          </>
        )}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}


