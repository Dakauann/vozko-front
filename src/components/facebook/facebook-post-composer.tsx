"use client";

import {
  ArrowDown,
  ArrowUp,
  ChartLineUp,
  Info,
  Sparkle,
  Trash,
  UploadSimple,
  Warning,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createFacebookPostAction } from "@/app/actions/facebook";
import { getCommentAnalysisSettingsAction, putCommentContainerSettingsAction } from "@/app/actions/audience";
import { uploadMediaAction } from "@/app/actions/medias";
import { OverrideFields } from "@/components/audience/override-fields";
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
import { PublishJobStatus } from "@/components/facebook/publish-job-status";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { CommentRuleFields } from "@/components/social/comment-rule-fields";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CommentAnalysisSettings } from "@/lib/audience/types";
import { overrideDraftFrom, overrideDraftToPut, type OverrideDraft } from "@/lib/audience/override";
import {
  MAX_ALBUM_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_REELS_PER_DAY,
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPE,
  composerProblems,
  toCreatePayload,
  type ComposerProblem,
} from "@/lib/facebook/composer";
import { jobOutcome } from "@/lib/facebook/publish-job";
import { toLocalDateTimeInput } from "@/lib/format/local-datetime";
import type { FacebookMediaRef, FacebookPage, FacebookPublishJob, FacebookPublishKind } from "@/lib/facebook/types";
import {
  FACEBOOK_RULE_ACTIONS,
  commentRuleFieldsErrors,
  type CommentRuleFieldsValue,
} from "@/lib/social/comment-rules";
import { facebookRuleApi } from "@/lib/social/comment-sources";

const KINDS: FacebookPublishKind[] = ["text", "link", "photo", "album", "video", "reel", "story"];
const MEDIA_KINDS = new Set<FacebookPublishKind>(["photo", "album", "video", "reel", "story"]);
const VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024;

interface UploadedMedia extends FacebookMediaRef {
  name: string;
}

function acceptFor(kind: FacebookPublishKind): string {
  if (kind === "video" || kind === "reel") return VIDEO_MIME_TYPE;
  if (kind === "story") return [...PHOTO_MIME_TYPES, VIDEO_MIME_TYPE].join(",");
  return PHOTO_MIME_TYPES.join(",");
}

const toLocalInput = toLocalDateTimeInput;

export function FacebookPostComposer({
  page,
  onClose,
  onFinished,
}: {
  page: FacebookPage;
  onClose: () => void;
  onFinished: (job: FacebookPublishJob) => void;
}) {
  const t = useTranslations("facebook.composer");
  const describeError = useFacebookError();
  const { can } = useWorkspace();
  const canConfigureAnalysis = can("audience", "update");
  const ruleApi = useMemo(() => facebookRuleApi(page.id), [page.id]);

  const [kind, setKind] = useState<FacebookPublishKind>("text");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [videoTitle, setVideoTitle] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  const [withRule, setWithRule] = useState(false);
  const [ruleFields, setRuleFields] = useState<CommentRuleFieldsValue>({
    match: "contains",
    keywords: "",
    actions: ["private_reply"],
    publicText: "",
    privateText: "",
  });

  const [withAnalysis, setWithAnalysis] = useState(false);
  const [pageAnalysis, setPageAnalysis] = useState<CommentAnalysisSettings | null>(null);
  const [analysisDraft, setAnalysisDraft] = useState<OverrideDraft | null>(null);
  const [analysisLoadError, setAnalysisLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!withAnalysis || pageAnalysis) return;
    let cancelled = false;
    void getCommentAnalysisSettingsAction("facebook", page.id).then((res) => {
      if (cancelled) return;
      if (res.error || !res.settings) {
        setAnalysisLoadError(res.error ?? t("analysisLoadFailed"));
        return;
      }
      setPageAnalysis(res.settings);
      setAnalysisDraft(overrideDraftFrom({ override: null, effective: res.settings }));
    });
    return () => {
      cancelled = true;
    };
  }, [withAnalysis, pageAnalysis, page.id, t]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<FacebookPublishJob | null>(null);
  const [followUpWarning, setFollowUpWarning] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const [now] = useState(() => new Date());
  const schedule = scheduling && kind !== "story" && scheduleAt ? new Date(scheduleAt) : null;
  const draft = {
    kind,
    message,
    link,
    media: media.map(({ url, mimeType, sizeBytes }) => ({ url, mimeType, sizeBytes })),
    videoTitle,
    scheduledAt: schedule,
  };
  const problems = composerProblems(draft, now);
  const ruleErrors = commentRuleFieldsErrors(ruleFields);
  const blocked =
    problems.length > 0 || (scheduling && kind !== "story" && !scheduleAt) || (withRule && !ruleErrors.valid);

  const changeKind = (next: FacebookPublishKind) => {
    setKind(next);
    setMedia([]);
    setError(null);
    if (next === "story") setScheduling(false);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const room = kind === "album" ? MAX_ALBUM_PHOTOS - media.length : 1;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    setUploading(true);
    const uploaded: UploadedMedia[] = [];
    for (const file of picked) {
      const isVideo = file.type.startsWith("video/");
      const cap = isVideo ? VIDEO_UPLOAD_BYTES : MAX_PHOTO_BYTES;
      if (file.size > cap) {
        setError(t("fileTooLarge", { name: file.name, limit: Math.round(cap / (1024 * 1024)) }));
        break;
      }
      const form = new FormData();
      form.append("media", file);
      form.append("mediaType", isVideo ? "video" : "image");
      form.append("description", file.name || t("title"));
      const result = await uploadMediaAction(form);
      if (result.error || !result.mediaUrl) {
        setError(result.error ?? t("uploadFailed"));
        break;
      }
      uploaded.push({ url: result.mediaUrl, mimeType: file.type, sizeBytes: file.size, name: file.name });
    }
    setUploading(false);
    setMedia((prev) => (kind === "album" ? [...prev, ...uploaded] : uploaded.slice(0, 1)));
  };

  const move = (index: number, delta: number) => {
    setMedia((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const applyFollowUps = useCallback(
    async (settled: FacebookPublishJob) => {
      const outcome = jobOutcome(settled);
      if ((outcome !== "published" && outcome !== "scheduled") || !settled.fbPostId) return;
      if (withRule) {
        const result = await ruleApi.create({
          name: t("ruleName"),
          enabled: true,
          containerId: settled.fbPostId,
          match: ruleFields.match,
          keywords: ruleErrors.keywordList,
          actions: ruleFields.actions,
          publicReplyText: ruleFields.publicText.trim(),
          privateReplyText: ruleFields.privateText.trim(),
          priority: 0,
        });
        if (result.error) {
          setFollowUpWarning(t("publishedButRuleFailed", { error: result.error }));
          return;
        }
      }
      if (withAnalysis && analysisDraft) {
        const result = await putCommentContainerSettingsAction(
          "facebook",
          page.id,
          settled.fbPostId,
          overrideDraftToPut(analysisDraft),
        );
        if (result.error) setFollowUpWarning(t("publishedButAnalysisFailed", { error: result.error }));
      }
    },
    [withRule, withAnalysis, analysisDraft, ruleApi, ruleFields, ruleErrors.keywordList, page.id, t],
  );

  const settle = useCallback(
    (settled: FacebookPublishJob) => {
      setJob(settled);
      void applyFollowUps(settled).then(() => setFinished(true));
    },
    [applyFollowUps],
  );

  const submit = async () => {
    if (blocked || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await createFacebookPostAction(page.id, toCreatePayload(draft));
    setSubmitting(false);
    if ("error" in result) {
      setError(describeError(result));
      return;
    }
    if (!result.job) {
      setError(t("publishFailed"));
      return;
    }
    setJob(result.job);
    if (["PUBLISHED", "SCHEDULED", "FAILED"].includes(result.job.status)) settle(result.job);
  };

  const problemText = (problem: ComposerProblem) => t(`problem.${problem}`);
  const busy = submitting || uploading || (job !== null && !finished);

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && !busy && (job ? onFinished(job) : onClose())}>
      <ElevatedDialogContent className="flex max-h-[min(90vh,820px)] w-full max-w-xl flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>

        {job ? (
          <div className="space-y-4 p-5">
            <PublishJobStatus pageId={page.id} job={job} pageLink={page.link} onSettled={settle} />
            {followUpWarning ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-warning-ink">
                <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
                {followUpWarning}
              </p>
            ) : null}
            <Button
              title={t("done")}
              variant="primary"
              className="w-full"
              disabled={!finished}
              onClick={() => onFinished(job)}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-sleek">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("kind")}</label>
                <ElevatedSegmentedControl
                  value={kind}
                  onChange={(v) => changeKind(v as FacebookPublishKind)}
                  disabled={busy}
                  options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
                />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  {t(`kindHint.${kind}`, { reels: MAX_REELS_PER_DAY, max: MAX_ALBUM_PHOTOS })}
                </p>
              </div>

              {kind !== "story" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("message")}</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={busy}
                    rows={4}
                    placeholder={t("messagePlaceholder")}
                    className="resize-y"
                  />
                </div>
              )}

              {kind === "link" && (
                <ElevatedInput
                  label={t("link")}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  disabled={busy}
                  placeholder="https://"
                />
              )}

              {kind === "video" && (
                <ElevatedInput
                  label={t("videoTitle")}
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  disabled={busy}
                />
              )}

              {MEDIA_KINDS.has(kind) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-foreground">{t("media")}</label>
                    <Button
                      title={uploading ? t("uploading") : t("upload")}
                      variant="outline"
                      size="sm"
                      icon={<UploadSimple className="h-3.5 w-3.5" />}
                      disabled={busy || (kind !== "album" && media.length >= 1) || media.length >= MAX_ALBUM_PHOTOS}
                      onClick={() => fileRef.current?.click()}
                    />
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    multiple={kind === "album"}
                    accept={acceptFor(kind)}
                    onChange={(e) => {
                      void handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {media.length === 0 ? (
                    <p className="rounded-[--radius] border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      {t("mediaEmpty")}
                    </p>
                  ) : (
                    <ol className="space-y-1.5">
                      {media.map((item, index) => (
                        <li
                          key={`${item.url}-${index}`}
                          className="flex items-center gap-2 rounded-[--radius] border border-border px-3 py-2 text-xs"
                        >
                          <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{index + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                          {kind === "album" && (
                            <>
                              <button
                                type="button"
                                onClick={() => move(index, -1)}
                                disabled={busy || index === 0}
                                aria-label={t("moveUp")}
                                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => move(index, 1)}
                                disabled={busy || index === media.length - 1}
                                aria-label={t("moveDown")}
                                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setMedia((prev) => prev.filter((_, i) => i !== index))}
                            disabled={busy}
                            aria-label={t("removeMedia")}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive-ink disabled:opacity-30"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {kind !== "story" && (
                <div className="rounded-[--radius] border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-sm font-medium text-foreground">{t("schedule")}</span>
                      <p className="text-xs text-muted-foreground">{t("scheduleHint")}</p>
                    </div>
                    <ElevatedSwitch
                      checked={scheduling}
                      onCheckedChange={setScheduling}
                      disabled={busy}
                      aria-label={t("schedule")}
                    />
                  </div>
                  {scheduling && (
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      min={toLocalInput(new Date(now.getTime() + 11 * 60_000))}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      disabled={busy}
                      aria-label={t("scheduleAt")}
                      className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  )}
                </div>
              )}

              {kind !== "story" && (
                <div className="rounded-[--radius] border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Sparkle className="h-3.5 w-3.5 text-primary-ink" weight="fill" />
                        {t("ruleTitle")}
                      </span>
                      <p className="text-xs text-muted-foreground">{t("ruleHint")}</p>
                    </div>
                    <ElevatedSwitch checked={withRule} onCheckedChange={setWithRule} disabled={busy} aria-label={t("ruleTitle")} />
                  </div>
                  {withRule && (
                    <div className="mt-4 border-t border-border pt-4">
                      <CommentRuleFields
                        value={ruleFields}
                        onChange={setRuleFields}
                        allowedActions={FACEBOOK_RULE_ACTIONS}
                        translationNamespace="facebook.commentRules"
                        disabled={busy}
                      />
                    </div>
                  )}
                </div>
              )}

              {kind !== "story" && canConfigureAnalysis && (
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
                      disabled={busy}
                      aria-label={t("analysisTitle")}
                    />
                  </div>
                  {withAnalysis && (
                    <div className="mt-4 border-t border-border pt-4">
                      {analysisLoadError ? (
                        <p className="text-xs text-destructive-ink">{analysisLoadError}</p>
                      ) : pageAnalysis && analysisDraft ? (
                        <>
                          {!pageAnalysis.enabled && (
                            <p className="mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Info className="mt-0.5 h-3 w-3 shrink-0" />
                              {t("analysisPageOff")}
                            </p>
                          )}
                          <OverrideFields
                            id="facebook-composer"
                            draft={analysisDraft}
                            onChange={setAnalysisDraft}
                            effective={pageAnalysis}
                            disabled={busy}
                          />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("analysisLoading")}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {problems.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {problems.map((problem) => (
                    <li key={problem} className="flex items-start gap-1.5">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      {problemText(problem)}
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-destructive-ink">
                  <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button title={t("cancel")} variant="ghost" disabled={busy} onClick={onClose} />
              <Button
                title={submitting ? t("publishing") : schedule ? t("scheduleSubmit") : t("publish")}
                variant="primary"
                disabled={blocked || busy}
                onClick={() => void submit()}
              />
            </ElevatedDialogFooter>
          </>
        )}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
