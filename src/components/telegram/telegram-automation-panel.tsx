"use client";

import {
  ChannelAutomationPanel,
  type ChannelAutomationPayload,
} from "@/components/channels/channel-automation-panel";

import type { TelegramAccount } from "@/lib/telegram/types";
import { updateTelegramAccountAction } from "@/app/actions/telegram";

export function TelegramAutomationPanel({
  account,
  onUpdated,
}: {
  account: TelegramAccount;
  onUpdated: (account: TelegramAccount) => void;
}) {
  return (
    <ChannelAutomationPanel<TelegramAccount>
      account={account}
      onUpdated={onUpdated}
      onSave={(accountId: string, payload: ChannelAutomationPayload) =>
        updateTelegramAccountAction(accountId, payload)
      }
      translationNamespace="telegram.automation"
      controlId="tg-automation-enabled"
      showHandling
    />
  );
}
