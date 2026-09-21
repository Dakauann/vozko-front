"use client";

import {
  ChannelAutomationPanel,
  type ChannelAutomationPayload,
} from "@/components/channels/channel-automation-panel";

import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { updateInstanceAction } from "@/app/actions/unofficial-whatsapp";

export function UnofficialWhatsAppAutomationPanel({
  instance,
  onUpdated,
}: {
  instance: UnofficialWhatsAppInstance;
  onUpdated: (instance: UnofficialWhatsAppInstance) => void;
}) {
  return (
    <ChannelAutomationPanel<UnofficialWhatsAppInstance>
      account={instance}
      onUpdated={onUpdated}
      onSave={async (instanceId: string, payload: ChannelAutomationPayload) => {
        const result = await updateInstanceAction(instanceId, payload);
        return { account: result.instance, error: result.error };
      }}
      translationNamespace="unofficialWhatsapp.automation"
      controlId="uw-automation-enabled"
    />
  );
}
