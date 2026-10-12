"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LIBRARY_NOTICES } from "@/lib/studio/library/notices";

const LINK_CLASS = "rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LibraryCredits() {
  const t = useTranslations("studio.library.credits");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={LINK_CLASS}>
        {t("link")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(85vh,44rem)] max-w-[min(92vw,40rem)] flex-col gap-3 p-5">
          <DialogTitle className="text-base">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {LIBRARY_NOTICES.map((notice) => (
              <section key={notice.id} aria-labelledby={`notice-${notice.id}`} className="space-y-1.5">
                <h3 id={`notice-${notice.id}`} className="text-sm font-semibold text-foreground">
                  {notice.name}
                </h3>
                <p className="text-2xs text-muted-foreground">
                  {t(`use.${notice.id}`)} · {t("license", { license: notice.license, version: notice.version })} ·{" "}
                  <a href={notice.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground">
                    {t("source")}
                  </a>
                </p>
                <pre className="whitespace-pre-wrap break-words rounded-[--radius] border border-border bg-muted p-3 font-mono text-2xs leading-relaxed text-muted-foreground">{notice.text}</pre>
              </section>
            ))}
            <section aria-labelledby="notice-trademarks" className="space-y-1.5">
              <h3 id="notice-trademarks" className="text-sm font-semibold text-foreground">
                {t("trademarks.title")}
              </h3>
              <p className="text-2xs text-muted-foreground">{t("trademarks.qrCode")}</p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
