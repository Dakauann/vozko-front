"use client";

import { useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";

/**
 * The two-step confirmation both destructive campaign actions use.
 *
 * Prepare issues a six-digit code, the operator types it back, confirm applies
 * it. Shared across channels and across reset/clear-history, because the flow is
 * identical and the code is the only thing standing between a misclick and
 * deleting a workspace's conversation history.
 */
export function CampaignConfirmModal({
  open,
  title,
  description,
  code,
  confirmLabel,
  cancelLabel,
  codeLabel,
  mismatchLabel,
  onConfirm,
  onClose,
  pending,
}: {
  open: boolean;
  title: string;
  description: string;
  /** The code the prepare step issued. Shown so the operator can type it back. */
  code?: string;
  confirmLabel: string;
  cancelLabel: string;
  codeLabel: string;
  mismatchLabel: string;
  onConfirm: (code: string) => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const [typed, setTyped] = useState("");

  if (!open) return null;

  // Compared here as well as on the server. The server check is the real one;
  // this exists so the operator is told immediately rather than after a round
  // trip that reads as a failure.
  const matches = code !== undefined && typed.trim() === code;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-[--radius] border border-border bg-background p-5 shadow-lg">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        {code ? (
          <div className="rounded-[--radius] border border-border bg-muted px-3 py-2 text-center">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              {codeLabel}
            </p>
            <p className="mt-0.5 font-mono text-xl font-semibold tracking-[0.3em] text-foreground">
              {code}
            </p>
          </div>
        ) : null}

        <ElevatedInput
          label={codeLabel}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          controlSize="sm"
          autoFocus
        />
        {typed.length > 0 && !matches ? (
          <p className="text-xs font-semibold text-destructive-ink">{mismatchLabel}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" title={cancelLabel} onClick={onClose} disabled={pending} />
          <Button
            // No destructive variant exists in the kit; the confirmation code
            // above is what makes this deliberate, not the button colour.
            variant="primary"
            title={confirmLabel}
            onClick={() => onConfirm(typed.trim())}
            disabled={!matches || pending}
          />
        </div>
      </div>
    </div>
  );
}
