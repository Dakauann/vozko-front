"use client";

import {
  FilmSlate,
  ImageSquare,
  Info,
  PlayCircle,
  Sparkle,
  UploadSimple,
  Warning,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { uploadMediaAction } from "@/app/actions/medias";

import {
  CommentRuleFields,
  commentRuleFieldsErrors,
  type CommentRuleFieldsValue,
} from "./comment-rule-fields";
import type { CommentRulePayload, InstagramMedia } from "@/lib/instagram/types";
import { createCommentRuleAction, createInstagramMediaAction } from "@/app/actions/instagram";
import { useTranslations } from "next-intl";

/**
 * Publish a post, and optionally arm its comment automation in the same step.
 *
 * The automation is the reason the composer exists as one flow rather than two
 * screens: a comment-to-DM campaign is worthless if the rule is added minutes
 * after the post went live, because the first comments arrive immediately.
 *
 * Publishing is asynchronous on Instagram's side (container → poll → publish),
 * so the button stays busy until the backend has actually published and can
 * return the media id the rule needs.
 */

type PostKind = "feed" | "reels" | "stories";

/** Mirrors the 25 MB ceiling enforced by the media upload use case. */
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

  const [kind, setKind] = useState<PostKind>("feed");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");

  const [withRule, setWithRule] = useState(false);
  const [ruleFields, setRuleFields] = useState<CommentRuleFieldsValue>({
    match: "contains",
    keywords: "",
    // A comment-to-DM campaign is the reason this exists, so it is preselected.
    actions: ["private_reply"],
    publicText: "",
    privateText: "",
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the post published but its rule did not: the post is live and must
  // not be re-published, so the dialog switches to reporting that precisely.
  const [ruleWarning, setRuleWarning] = useState<string | null>(null);

  // Reels and Stories are video surfaces here; a feed post takes a JPEG.
  const isVideo = kind !== "feed";

  // Same validation the rule dialog uses, so a rule armed here is exactly a rule
  // created there.
  const ruleErrors = commentRuleFieldsErrors(ruleFields);
  const invalid = !mediaUrl.trim() || (withRule && !ruleErrors.valid);

  // Uploading through our own media storage gives the public URL Instagram
  // requires, so an operator picks a file instead of hunting for a hosted link.
  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    // The server caps uploads at 25 MB and rejects the request after the whole
    // body has travelled. Checking here fails a 200 MB Reel instantly instead of
    // after a long upload.
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }

    setUploading(true);
    setError(null);

    /* POST /medias requires all three fields — `media`, a non-empty `mediaType`,
       and a non-empty `description` — and rejects the request outright otherwise.
       Same shape every other uploader in the app sends. */
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

    // The post is live from here on. A rule failure must never look like a
    // publish failure, or the operator will try to publish again.
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

        {ruleWarning ? (
          // The post published; only the rule failed. Say exactly that, and do
          // not offer "publish" again.
          <div className="space-y-4 p-5">
            <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
              {t("publishedButRuleFailed", { error: ruleWarning })}
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
                  // JPEG for feed posts is Instagram's rule, not ours; the picker
                  // enforces it so a rejected upload never reaches publish.
                  accept={isVideo ? "video/mp4,video/quicktime" : "image/jpeg"}
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
                {/* Instagram's own constraint, stated before the failure rather
                    than after: a PNG is rejected at publish time. */}
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
                  {/* Captions cannot be edited after publishing — Instagram has no
                      such endpoint — so the operator is warned while it still
                      matters. */}
                  <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                    <Warning className="mt-0.5 h-3 w-3 shrink-0" />
                    {t("captionImmutable")}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Sparkle className="h-3.5 w-3.5 text-primary" weight="fill" />
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

              {error && (
                <p className="flex items-start gap-2 rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
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


