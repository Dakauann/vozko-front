"use client";

import {
  ChannelAutomationPanel,
  type ChannelAutomationPayload,
} from "@/components/channels/channel-automation-panel";

import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { updateInstanceAction } from "@/app/actions/unofficial-whatsapp";

/**
 * Unofficial WhatsApp's binding of the shared automation panel.
 *
 * The previous version of this screen shipped bare "agent answers" / "workflows
 * active" switches and no way to choose WHICH agent or workflow, so turning them
 * on wrote `enable*: true` against a null `agentId` and nothing ever answered —
 * a setting that looked saved and did nothing. Reusing the shared panel is not
 * only less code: it is the only place the selector, the exclusive agent/workflow
 * choice, and the "cannot enable without a selection" rule exist.
 *
 * Attendance itself is channel-agnostic underneath: the inbound consumer hands
 * each message to the same AI reply service and fires the same workflow triggers,
 * keyed on (entry_id, entry_type), exactly as Telegram and Instagram do.
 */
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
        // The channel's action names the entity `instance`; the panel's contract
        // names it `account`. Renamed here rather than widening the shared
        // contract, so one channel's vocabulary does not leak into all of them.
        const result = await updateInstanceAction(instanceId, payload);
        return { account: result.instance, error: result.error };
      }}
      translationNamespace="unofficialWhatsapp.automation"
      controlId="uw-automation-enabled"
    />
  );
}
