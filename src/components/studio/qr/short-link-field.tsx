"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { createLink, listLinks } from "@/app/actions/links";
import { ArrowSquareOut, CircleNotch, Link } from "@/components/icons";
import { Link as LocaleLink } from "@/i18n/routing";
import type { ShortLink } from "@/lib/links/types";
import { isQrUrl, type QrLink } from "@/lib/studio/qr";

import { FIELD_CLASS, Notice, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SelectField } from "../image/controls";

const LINK_PAGE = 50;
const NONE = "";

interface ShortLinkFieldProps {
  link: QrLink;
  disabled: boolean;
  autoFocus?: boolean;
  onLink: (link: QrLink) => boolean;
}

function shortLinkOf(entry: ShortLink): QrLink | null {
  return entry.shortUrl ? { kind: "shortLink", shortLinkId: entry.id, url: entry.shortUrl } : null;
}

export function ShortLinkField({ link, disabled, autoFocus, onLink }: ShortLinkFieldProps) {
  const t = useTranslations("studio.qr.shortLink");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [existing, setExisting] = useState<ShortLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listLinks({ pageSize: LINK_PAGE }).then((result) => {
      if (!cancelled && !result.error) setExisting(result.items.filter((entry) => entry.status === "active" && entry.shortUrl));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    const url = target.trim();
    if (!isQrUrl(url)) {
      setFailure(t("badTarget"));
      return;
    }
    setBusy(true);
    setFailure(null);
    const result = await createLink({ targetUrl: url, title: t("title") });
    setBusy(false);
    const made = result.link ? shortLinkOf(result.link) : null;
    if (!made) {
      setFailure(result.error ? t("failedWith", { reason: result.error }) : t("failed"));
      return;
    }
    setExisting((current) => [result.link!, ...current.filter((entry) => entry.id !== result.link!.id)]);
    setTarget("");
    if (!onLink(made)) setFailure(t("refused"));
  };

  const current = link.kind === "shortLink" ? link : null;

  return (
    <div className="space-y-2">
      {current ? (
        <div className="flex items-center justify-between gap-2 rounded-[--radius] border border-border px-2 py-1.5 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <Link className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{current.url}</span>
          </span>
          <LocaleLink href={`/dashboard/links/${current.shortLinkId}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground hover:text-foreground">
            {t("scans")}
            <ArrowSquareOut className="h-3 w-3" aria-hidden />
          </LocaleLink>
        </div>
      ) : null}
      <label className="block space-y-1">
        <span className="text-2xs text-muted-foreground">{t("target")}</span>
        <input type="url" autoFocus={autoFocus} value={target} disabled={disabled || busy} placeholder="https://" onChange={(event) => setTarget(event.target.value)} className={FIELD_CLASS} />
      </label>
      <button type="button" disabled={disabled || busy || target.trim() === ""} onClick={() => void create()} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        {busy ? <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Link className="h-3.5 w-3.5" aria-hidden />}
        {t("create")}
      </button>
      {existing.length > 0 ? (
        <SelectField<string>
          label={t("existing")}
          value={current && existing.some((entry) => entry.id === current.shortLinkId) ? current.shortLinkId : NONE}
          disabled={disabled}
          options={[{ value: NONE, label: t("pick") }, ...existing.map((entry) => ({ value: entry.id, label: entry.title ? `${entry.title} (${entry.code})` : entry.code }))]}
          onChange={(id) => {
            const entry = existing.find((candidate) => candidate.id === id);
            const made = entry ? shortLinkOf(entry) : null;
            if (made && !onLink(made)) setFailure(t("refused"));
          }}
        />
      ) : null}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      {failure ? <Notice tone="fault" title={failure} /> : null}
      <LocaleLink href="/dashboard/links" target="_blank" rel="noreferrer" className={`${OUTLINE_BUTTON_CLASS} w-full`}>
        {t("manage")}
      </LocaleLink>
    </div>
  );
}
