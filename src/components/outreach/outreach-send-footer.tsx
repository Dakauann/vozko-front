"use client";

import Button from "@/components/elevated-design/button";
import { ElevatedDialogFooter } from "@/components/elevated-design/elevated-dialog";
import { CircleNotch, PaperPlaneTilt } from "@/components/icons";

export interface OutreachSendLabels {
  cancel: string;
  submit: string;
  sending: string;
}

export function OutreachSendFooter({
  labels,
  busy,
  canSubmit,
  showSubmit = true,
  onCancel,
  onSubmit,
}: {
  labels: OutreachSendLabels;
  busy: boolean;
  canSubmit: boolean;
  showSubmit?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <ElevatedDialogFooter className="-mx-7 shrink-0 border-t border-border px-7 pt-4">
      <Button variant="secondary" title={labels.cancel} onClick={onCancel} disabled={busy} />
      {showSubmit && (
        <Button
          variant="primary"
          title={busy ? labels.sending : labels.submit}
          icon={busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <PaperPlaneTilt className="h-4 w-4" weight="fill" />}
          iconVisible
          iconSide="left"
          onClick={onSubmit}
          disabled={!canSubmit || busy}
        />
      )}
    </ElevatedDialogFooter>
  );
}
