"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowClockwise,
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock,
  Image as ImageIcon,
  PaperPlaneTilt,
  SpinnerGap,
  Warning,
  X,
} from "@phosphor-icons/react";
import type { Issue, IssueResponse } from "@/lib/issues/types";
import {
  closeIssueAction,
  createIssueResponseAction,
  getIssueAction,
  listIssueResponsesAction,
} from "@/app/actions/issues";
import { useCallback, useEffect, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { uploadMediaAction } from "@/app/actions/medias";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; 
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const statusConfig: Record<
  string,
  { color: string; bgColor: string; icon: Icon; label: string }
> = {
  open: {
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: Circle,
    label: "open",
  },
  in_progress: {
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: ArrowClockwise,
    label: "in_progress",
  },
  closed: {
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: CheckCircle,
    label: "closed",
  },
};

function formatTimestamp(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface IssueDetailClientProps {
  issueId: string;
}

export default function IssueDetailClient({ issueId }: IssueDetailClientProps) {
  const t = useTranslations("issuesPage");
  const router = useRouter();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [issue, setIssue] = useState<Issue | null>(null);
  const [responses, setResponses] = useState<IssueResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [responseBody, setResponseBody] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const isAdmin = user?.role === "admin";
  const isClosed = issue?.status === "closed";

  const fetchIssue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [issueResult, responsesResult] = await Promise.all([
        getIssueAction(issueId),
        listIssueResponsesAction(issueId),
      ]);

      if (issueResult.error) {
        setError(issueResult.error);
        return;
      }

      setIssue(issueResult.issue);
      setResponses(responsesResult.responses);
    } catch {
      setError(t("error.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [issueId, t]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [responses]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setSubmitError(t("response.error.invalidType"));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setSubmitError(t("response.error.tooLarge"));
      return;
    }

    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("media", file);
    formData.append("mediaType", "image");
    formData.append("description", "issue-response-attachment");

    const result = await uploadMediaAction(formData);
    if (result.error || !result.mediaUrl) {
      setSubmitError(t("response.error.imageUploadFailed"));
      setImagePreview(null);
      setImageUrl(null);
    } else {
      setImageUrl(result.mediaUrl);
    }
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageUrl(null);
  };

  const handleSubmitResponse = async () => {
    const trimmed = responseBody.trim();
    if (!trimmed) return;

    if (trimmed.length > 2000) {
      setSubmitError(t("response.error.tooLong"));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createIssueResponseAction(issueId, {
        body: trimmed,
        imageUrl: imageUrl ?? undefined,
      });

      if (result.error) {
        setSubmitError(result.error);
        return;
      }

      if (result.response) {
        setResponses((prev) => [...prev, result.response!]);
        setResponseBody("");
        setImagePreview(null);
        setImageUrl(null);
      }
    } catch {
      setSubmitError(t("response.error.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!issue || closing) return;

    setClosing(true);
    try {
      const result = await closeIssueAction(issueId);
      if (result.error) {
        setError(result.error);
      } else if (result.issue) {
        setIssue(result.issue);
      }
    } catch {
      setError(t("error.closeFailed"));
    } finally {
      setClosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitResponse();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !issue) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard/issues")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.back")}
        </button>
        <div className="rounded-xl border border-red-600 bg-red-500 px-4 py-3 text-sm text-white">
          {error}
        </div>
      </div>
    );
  }

  if (!issue) return null;

  const config = statusConfig[issue.status] ?? statusConfig.open;
  const StatusIcon = config.icon;

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-4xl mx-auto space-y-6 py-2"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/dashboard/issues")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.back")}
      </button>

      {/* Issue header */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-foreground break-words">
              {issue.title}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTimestamp(issue.createdAt)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  config.bgColor,
                  config.color,
                )}
              >
                <StatusIcon className="h-3 w-3" weight="bold" />
                {t(`status.${config.label}` as Parameters<typeof t>[0])}
              </span>
            </div>
          </div>

          {isAdmin && !isClosed && (
            <Button
              variant="secondary"
              title={closing ? t("detail.closing") : t("detail.close")}
              onClick={handleClose}
              disabled={closing}
              className="shrink-0"
            />
          )}
        </div>

        {issue.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {issue.description}
          </p>
        )}

        {issue.imageUrls && issue.imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            {issue.imageUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={url}
                  alt={`${t("detail.attachedImage")} ${idx + 1}`}
                  className="max-h-48 rounded-lg border border-border hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Responses timeline */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-foreground">
            {t("detail.responses")} ({responses.length})
          </h2>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <Warning className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("detail.noResponses")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {responses.map((resp) => (
                  <motion.div
                    key={resp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="px-6 py-4 space-y-2"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {resp.authorId === user?.id
                          ? t("detail.you")
                          : t("detail.staff")}
                      </span>
                      <span>·</span>
                      <span>{formatTimestamp(resp.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {resp.body}
                    </p>
                    {resp.imageUrl && (
                      <div className="mt-2">
                        <img
                          src={resp.imageUrl}
                          alt={t("detail.attachedImage")}
                          className="max-w-sm rounded-lg border border-border"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Response form, not closed */}
        {!isClosed && (
          <div className="border-t border-border p-4 space-y-3">
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt={t("response.imagePreview")}
                  className="h-20 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5 shadow-sm hover:bg-destructive/80 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <textarea
                  value={responseBody}
                  onChange={(e) => setResponseBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("response.placeholder")}
                  rows={2}
                  maxLength={2000}
                  disabled={submitting}
                  className={cn(
                    "w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                />
                <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/50">
                  {responseBody.length}/2000
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg border border-input p-2",
                    "hover:bg-muted cursor-pointer transition-colors",
                    submitting && "opacity-50 pointer-events-none",
                  )}
                >
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    onChange={handleImageSelect}
                    className="sr-only"
                    disabled={submitting}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSubmitResponse}
                  disabled={submitting || !responseBody.trim()}
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground p-2",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  {submitting ? (
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                  ) : (
                    <PaperPlaneTilt className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}
          </div>
        )}

        {/* Closed notice */}
        {isClosed && (
          <div className="border-t border-border px-6 py-3 bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">
              {t("detail.closedNotice")}
            </p>
          </div>
        )}
      </div>
    </motion.main>
  );
}
