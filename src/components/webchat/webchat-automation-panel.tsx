"use client";

import {
  ChannelAutomationPanel,
  type ChannelAutomationPayload,
} from "@/components/channels/channel-automation-panel";

import type { WebchatWidget } from "@/lib/webchat/types";
import { updateWebchatWidgetAction } from "@/app/actions/webchat";

export function WebchatAutomationPanel({
  widget,
  onUpdated,
}: {
  widget: WebchatWidget;
  onUpdated: (widget: WebchatWidget) => void;
}) {
  return (
    <ChannelAutomationPanel<WebchatWidget>
      account={widget}
      onUpdated={onUpdated}
      onSave={(widgetId: string, payload: ChannelAutomationPayload) =>
        updateWebchatWidgetAction(widgetId, payload).then((result) => ({
          account: "widget" in result ? result.widget : undefined,
          error: "error" in result ? result.error : undefined,
        }))
      }
      translationNamespace="webchat.automation"
      controlId="webchat-automation-enabled"
      showHandling
      dealEntryType="webchat"
    />
  );
}
