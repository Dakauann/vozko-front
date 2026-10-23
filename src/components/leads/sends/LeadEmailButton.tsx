"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/elevated-design/button";
import { StartEmailConversationDialog } from "@/components/email-marketing/start-email-conversation-dialog";
import { EnvelopeSimple } from "@/components/icons";
import { useEmailOutreachAvailability } from "@/hooks/use-email-outreach";
import { conversationHref, isEntryType } from "@/lib/conversations/deep-link";

export function LeadEmailButton({ leadId, name, email, label }: { leadId: string; name: string; email: string | undefined; label: string }) {
  const router = useRouter();
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
      <StartEmailConversationDialog
        open={open}
        onOpenChange={setOpen}
        target={{ kind: "lead", leadId, name, email }}
        onStarted={(conversationId, entryType) => router.push(conversationHref(conversationId, isEntryType(entryType) ? entryType : "email"))}
      />
    </>
  );
}
