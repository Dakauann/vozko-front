"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/elevated-design/button";
import { StartEmailConversationDialog } from "@/components/email-marketing/start-email-conversation-dialog";
import { EnvelopeSimple } from "@/components/icons";
import { useEmailOutreachAvailability } from "@/hooks/use-email-outreach";
import { conversationHref, isEntryType } from "@/lib/conversations/deep-link";

type LeadEmailTarget = { leadId: string; name: string; email: string | undefined };

export function LeadEmailDialog({ target, open, onOpenChange }: { target: LeadEmailTarget; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  if (!target.email) return null;
  return <StartEmailConversationDialog open={open} onOpenChange={onOpenChange} target={{ kind: "lead", ...target, email: target.email }} onStarted={(conversationId, entryType) => router.push(conversationHref(conversationId, isEntryType(entryType) ? entryType : "email"))} />;
}

export function LeadEmailButton({ leadId, name, email, label }: LeadEmailTarget & { label: string }) {
  const { available } = useEmailOutreachAvailability();
  const [open, setOpen] = useState(false);

  if (!email || !available) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={<EnvelopeSimple className="h-3.5 w-3.5" />}
        iconVisible
        iconSide="left"
        title={label}
        onClick={() => setOpen(true)}
      />
      <LeadEmailDialog
        open={open}
        onOpenChange={setOpen}
        target={{ leadId, name, email }}
      />
    </>
  );
}
