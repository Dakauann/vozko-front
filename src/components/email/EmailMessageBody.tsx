"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState, type ReactNode } from "react";

import { ArrowsOut, Image as ImageIcon } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ConversationMessage } from "@/lib/conversations/types";
import {
  emailFrameDocument,
  emailHasHTML,
  emailSubject,
  fetchEmailHTML,
  type EmailHTMLErrorCode,
  type EmailHTMLView,
} from "@/lib/email/html-view";

const PREVIEW_LIMIT = 280;

export const EMAIL_FRAME_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

type Loaded = { view: EmailHTMLView } | { error: EmailHTMLErrorCode } | null;

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LIMIT ? `${flat.slice(0, PREVIEW_LIMIT).trimEnd()}...` : flat;
}

export function EmailHTMLFrame({ view, title }: { view: EmailHTMLView; title: string }) {
  return (
    <iframe
      title={title}
      sandbox={EMAIL_FRAME_SANDBOX}
      referrerPolicy="no-referrer"
      srcDoc={emailFrameDocument(view.html, !view.images_blocked)}
      className="h-full min-h-0 w-full flex-1 rounded-md border border-border bg-white"
    />
  );
}

interface EmailMessageBodyProps {
  message: ConversationMessage;
  fallback: ReactNode;
}

export function EmailMessageBody({ message, fallback }: EmailMessageBodyProps) {
  const t = useTranslations("crmConversation.emailView");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (showImages: boolean) => {
      setLoading(true);
      setLoaded(await fetchEmailHTML(message.entry_id, message.id, showImages));
      setLoading(false);
    },
    [message.entry_id, message.id],
  );

  if (!emailHasHTML(message)) return <>{fallback}</>;

  const subject = emailSubject(message) ?? t("noSubject");
  const openFull = () => {
    setOpen(true);
    if (!loaded) void load(false);
  };
  const view = loaded && "view" in loaded ? loaded.view : null;
  const error = loaded && "error" in loaded ? loaded.error : null;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="truncate text-sm font-semibold">{subject}</p>
      {message.text ? <p className="line-clamp-3 break-words text-sm leading-relaxed text-foreground/80">{preview(message.text)}</p> : null}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openFull();
        }}
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary-ink hover:underline focus-visible:underline focus-visible:outline-none"
      >
        <ArrowsOut weight="bold" className="h-3.5 w-3.5" />
        {t("fullEmail")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85vh] max-w-3xl flex-col gap-3 p-4 sm:p-5">
          <DialogHeader className="pr-8">
            <DialogTitle className="truncate text-base">{subject}</DialogTitle>
            <DialogDescription className="sr-only">{t("frameTitle")}</DialogDescription>
          </DialogHeader>

          {view?.inbound && view.images_blocked ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span>{t("imagesBlocked")}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => void load(true)}
                className="inline-flex items-center gap-1 font-medium text-primary-ink hover:underline disabled:opacity-60"
              >
                <ImageIcon weight="bold" className="h-3.5 w-3.5" />
                {t("showImages")}
              </button>
            </div>
          ) : null}

          {loading && !view ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
          {error ? <p className="text-sm text-muted-foreground">{t(`errors.${error}`)}</p> : null}
          {view?.has_html ? <EmailHTMLFrame view={view} title={t("frameTitle")} /> : null}
          {view && !view.has_html ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <p className="mb-2 text-xs text-muted-foreground">{t("textOnly")}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{view.text}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
