"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { createEmailCampaignAction, isEmailActionError } from "@/app/actions/email-campaigns";
import { useEmailErrorMessage, useEmailPermission } from "@/components/email-campaigns/shared";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { emailCampaignsRoot } from "@/hooks/use-email-campaigns";
import { audienceOfSelection, campaignRequest, emptyDraft } from "@/lib/email-campaigns/draft";
import { wizardHref } from "@/lib/email-campaigns/status";
import type { LeadSelection } from "@/lib/leads/actions";

export function LeadEmailCampaignDialog({ selection, onClose }: { selection: LeadSelection; onClose: () => void }) {
  const t = useTranslations("leadsPage.bulk.emailCampaign");
  const allowed = useEmailPermission();
  const errorMessage = useEmailErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const canCreate = allowed("read") && allowed("create");

  const create = async () => {
    if (!canCreate || !currentWorkspace || !name.trim() || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const audience = audienceOfSelection({ ...selection, exclude_ids: selection.excludeIds });
      const request = campaignRequest({ ...emptyDraft(), name, audience });
      if (!request.selection) {
        setError(t("invalidSelection"));
        return;
      }
      const result = await createEmailCampaignAction(request);
      if (isEmailActionError(result)) {
        setError(errorMessage(result));
        return;
      }
      void client.invalidateQueries({ queryKey: emailCampaignsRoot(currentWorkspace.id) });
      router.push(wizardHref(result.data.id));
      onClose();
    } catch {
      setError(errorMessage({}));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <ElevatedDialogContent>
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <ElevatedInput label={t("name")} value={name} onChange={(event) => setName(event.target.value)} disabled={saving} required />
          {error ? <Notice tone="fault"><p>{error}</p></Notice> : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} disabled={saving} onClick={onClose} />
          <Button title={t("continue")} disabled={!canCreate || !currentWorkspace || !name.trim() || saving} onClick={() => void create()} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
