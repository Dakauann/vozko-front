"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Check, Copy } from "@/components/icons";

const CONFIRMATION_MS = 1500;

interface CopyValueButtonProps {
  value: string;
  label: string;
  copiedMessage: string;
  children: ReactNode;
}

export function CopyValueButton({ value, label, copiedMessage, children }: CopyValueButtonProps) {
  const t = useTranslations("crmContactPanel");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={label}
        title={label}
        className="group inline-flex max-w-full items-center gap-1.5 truncate rounded-[--radius] text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{children}</span>
        {copied ? (
          <Check weight="bold" className="h-3 w-3 shrink-0 text-healthy-ink" aria-hidden />
        ) : (
          <Copy weight="bold" className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedMessage : ""}
      </span>
    </>
  );
}
