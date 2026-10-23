"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import { Check, Copy } from "@/components/icons";
import { cn } from "@/lib/utils";

const CONFIRMATION_MS = 1500;

export function CopyableCode({
  code,
  copyLabel,
  copiedLabel,
  failedLabel,
  className,
  wrap = false,
}: {
  code: string;
  copyLabel: string;
  copiedLabel: string;
  failedLabel: string;
  className?: string;
  wrap?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast.error(failedLabel);
    }
  };

  return (
    <div className={cn("relative rounded-[--radius] border border-border bg-muted", className)}>
      <Button
        variant="outline-subtle"
        size="icon"
        iconVisible
        aria-label={copyLabel}
        className="absolute right-1.5 top-1.5 z-10"
        icon={copied ? <Check className="h-3.5 w-3.5 text-healthy-ink" weight="bold" /> : <Copy className="h-3.5 w-3.5" />}
        onClick={() => void copy()}
      />
      <pre className={cn("max-h-80 overflow-auto p-3 pr-12 font-mono text-xs leading-relaxed text-foreground", wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre")}>
        <code>{code}</code>
      </pre>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </div>
  );
}
