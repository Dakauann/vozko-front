"use client";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Check, Copy, Key, Warning } from "@phosphor-icons/react";

import Button from "@/components/elevated-design/button";
import type { BranchSecretResult } from "@/lib/branches/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface BranchSecretDialogProps {
  result: BranchSecretResult | null;
  rotated?: boolean;
  onClose: () => void;
}

/**
 * Surfaces the one-time SIP password after create / rotate. The plaintext is
 * never returned again by the API, so this is the only moment the operator can
 * capture it. Every field is copy-to-clipboard; the warning is unmissable.
 */
export default function BranchSecretDialog({ result, rotated, onClose }: BranchSecretDialogProps) {
  const t = useTranslations("branchesPage.secret");

  if (!result) return null;

  return (
    <ElevatedDialog open={!!result} onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-[460px]">
        <ElevatedDialogHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Key weight="fill" className="h-5 w-5" />
          </div>
          <ElevatedDialogTitle>{rotated ? t("titleRotated") : t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("howto")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="flex flex-col gap-2.5">
          {result.connection?.configured ? (
            <>
              <CopyRow label={t("server")} value={result.connection.server} mono />
              <CopyRow label={t("port")} value={String(result.connection.port)} mono />
              <CopyRow label={t("transport")} value={result.connection.transport} />
            </>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 px-3.5 py-3 text-muted-foreground ring-1 ring-border">
              <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-[13px] leading-snug">{t("serverNotConfigured")}</p>
            </div>
          )}
          <CopyRow label={t("sipUser")} value={result.sipUser} mono />
          <CopyRow label={t("password")} value={result.secret} mono strong />
          <CopyRow label={t("realm")} value={result.realm} />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-3.5 py-3 text-amber-800 ring-1 ring-amber-500/20 dark:text-amber-200">
          <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-[13px] leading-snug">{t("warning")}</p>
        </div>

        <ElevatedDialogFooter>
          <Button variant="action" title={t("done")} onClick={onClose} className="w-full sm:w-auto" />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function CopyRow({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  const t = useTranslations("branchesPage.secret");
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: t("copied") });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`truncate text-foreground ${mono ? "font-mono" : ""} ${strong ? "text-[15px] font-semibold" : "text-sm"}`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={t("copy")}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {copied ? <Check weight="bold" className="h-4 w-4 text-emerald-600" /> : <Copy weight="bold" className="h-4 w-4" />}
      </button>
    </div>
  );
}
