"use client";

import {
  ChannelAutomationPanel,
  type ChannelAutomationPayload,
} from "@/components/channels/channel-automation-panel";

import type { TelegramAccount } from "@/lib/telegram/types";
import { updateTelegramAccountAction } from "@/app/actions/telegram";

/**
 * Telegram's binding of the shared automation panel.
 *
 * Agent and workflow attendance work here exactly as they do on the other
 * channels: the inbound handler hands each message to the same channel-agnostic
 * AI reply service and fires the same workflow triggers, both keyed on
 * (entry_id, entry_type).
 */
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
    />
  );
}
