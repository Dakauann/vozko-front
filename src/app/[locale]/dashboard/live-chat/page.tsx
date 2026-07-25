import LiveChatClient from "./_components/LiveChatClient";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function LiveChatPage() {
  const t = await getTranslations("liveChat");

  return (
    <LiveChatClient
      translations={{
        title: t("title"),
        description: t("description"),
        badge: t("badge"),
        filterAll: t("filterAll"),
        filterWhatsapp: t("filterWhatsapp"),
        filterVoice: t("filterVoice"),
        filterAllCampaigns: t("filterAllCampaigns"),
        filterStandard: t("filterStandard"),
        filterOrganic: t("filterOrganic"),
        campaignSelectorPlaceholder: t("campaignSelectorPlaceholder"),
        campaignSelectorSearch: t("campaignSelectorSearch"),
        campaignSelectorAll: t("campaignSelectorAll"),
        campaignSelectorEmpty: t("campaignSelectorEmpty"),
        campaignSelectorLoadMore: t("campaignSelectorLoadMore"),
        inbox: {
          title: t("inbox.title"),
          searchPlaceholder: t("inbox.searchPlaceholder"),
          noConversations: t("inbox.noConversations"),
          connecting: t("inbox.connecting"),
          disconnected: t("inbox.disconnected"),
          connected: t("inbox.connected"),
          loadingMore: t("inbox.loadingMore"),
        },
        conversation: {
          noConversationSelected: t("conversation.noConversationSelected"),
          noConversationDescription: t(
            "conversation.noConversationDescription",
          ),
          loadingMore: t("conversation.loadingMore"),
          windowClosed: t("conversation.windowClosed"),
          windowClosedDescription: t("conversation.windowClosedDescription"),
          aiEnabled: t("conversation.aiEnabled"),
          aiDisabled: t("conversation.aiDisabled"),
          aiToggleTooltip: t("conversation.aiToggleTooltip"),
          call: t("conversation.call"),
          callViaSip: t("conversation.callViaSip"),
          callViaWhatsapp: t("conversation.callViaWhatsapp"),
          comingSoon: t("conversation.comingSoon"),
          ringing: t("conversation.ringing"),
          inCall: t("conversation.inCall"),
          callEnded: t("conversation.callEnded"),
          callFailed: t("conversation.callFailed"),
          busy: t("conversation.busy"),
          noAnswer: t("conversation.noAnswer"),
          declined: t("conversation.declined"),
          endCall: t("conversation.endCall"),
          startCall: t("conversation.startCall"),
          noPermissionStageAssign: t("conversation.noPermissionStageAssign"),
        },
        input: {
          placeholder: t("input.placeholder"),
          windowClosed: t("input.windowClosed"),
          windowClosedDescription: t("input.windowClosedDescription"),
          sendButton: t("input.sendButton"),
          attachFile: t("input.attachFile"),
          recording: t("input.recording"),
          uploading: t("input.uploading"),
          windowExpires: t("input.windowExpires"),
          noPermissionSend: t("input.noPermissionSend"),
        },
      }}
    />
  );
}
