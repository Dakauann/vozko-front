"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  isEmailActionError,
  launchEmailCampaignAction,
  pauseEmailCampaignAction,
  resumeEmailCampaignAction,
  stopEmailCampaignAction,
  unscheduleEmailCampaignAction,
  type EmailActionResult,
} from "@/app/actions/email-campaigns";
import { useWorkspace } from "@/contexts/workspace-context";
import { emailCampaignsRoot } from "@/hooks/use-email-campaigns";
import type { CampaignCommand } from "@/lib/email-campaigns/status";
import type { Campaign } from "@/lib/email-campaigns/types";

import { useEmailErrorMessage } from "./shared";

const RUNNERS: Record<CampaignCommand, (id: string) => Promise<EmailActionResult<Campaign>>> = {
  start: (id) => launchEmailCampaignAction(id),
  pause: pauseEmailCampaignAction,
  resume: resumeEmailCampaignAction,
  stop: stopEmailCampaignAction,
  unschedule: unscheduleEmailCampaignAction,
};

export function useCampaignCommands(onDone?: (campaign: Campaign, command: CampaignCommand) => void) {
  const t = useTranslations("emailCampaigns.commands");
  const errorMessage = useEmailErrorMessage();
  const client = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (command: CampaignCommand, campaignId: string) => {
      setBusy(`${command}:${campaignId}`);
      const result = await RUNNERS[command](campaignId);
      setBusy(null);
      if (isEmailActionError(result)) {
        toast.error(t(`${command}.failed`), { description: errorMessage(result) });
        return false;
      }
      toast.success(t(`${command}.done`));
      await client.invalidateQueries({ queryKey: emailCampaignsRoot(workspaceId) });
      onDone?.(result.data, command);
      return true;
    },
    [client, errorMessage, onDone, t, workspaceId],
  );

  return { run, busy };
}
