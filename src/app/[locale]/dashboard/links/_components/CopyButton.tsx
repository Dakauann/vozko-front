"use client";

import { useState } from "react";

import { Check, Copy } from "@/components/icons";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label: string;
  copiedLabel: string;
  className?: string;
}

export function CopyButton({ value, label, copiedLabel, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(copiedLabel);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(label);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {copied ? (
        <Check className="h-4 w-4 text-healthy-ink" weight="bold"aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" weight="bold" aria-hidden="true" />
      )}
    </button>
  );
}
