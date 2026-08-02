"use client";

import {
  ChannelAutomationPanel,
  type ChannelAutomationPayload,
} from "@/components/channels/channel-automation-panel";

import type { InstagramAccount } from "@/lib/instagram/types";
import { updateInstagramAccountAction } from "@/app/actions/instagram";

/**
 * Instagram's binding of the shared automation panel.
 *
 * The agent-or-workflow choice is identical on every channel, so the behaviour
 * lives in ChannelAutomationPanel and only the save call and the translation
 * namespace are supplied here.
 */
export function InstagramAutomationPanel({
  account,
  onUpdated,
}: {
  account: InstagramAccount;
  onUpdated: (account: InstagramAccount) => void;
}) {
  return (
    <ChannelAutomationPanel<InstagramAccount>
      account={account}
      onUpdated={onUpdated}
      onSave={(accountId: string, payload: ChannelAutomationPayload) =>
        updateInstagramAccountAction(accountId, payload)
      }
      translationNamespace="instagram.automation"
      controlId="ig-automation-enabled"
    />
  );
}
