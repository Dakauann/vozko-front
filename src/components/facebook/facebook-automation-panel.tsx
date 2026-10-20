"use client";

import { updateFacebookPageAction } from "@/app/actions/facebook";
import { AutomationDisclosureEditor } from "@/components/channels/automation-disclosure-editor";
import { ChannelAutomationPanel, type ChannelAutomationPayload } from "@/components/channels/channel-automation-panel";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { withPageConfig } from "@/lib/facebook/page";
import type { FacebookPage } from "@/lib/facebook/types";

export function FacebookAutomationPanel({
  page,
  onUpdated,
}: {
  page: FacebookPage;
  onUpdated: (page: FacebookPage) => void;
}) {
  const describeError = useFacebookError();

  const save = async (pageId: string, payload: ChannelAutomationPayload) => {
    const result = await updateFacebookPageAction(pageId, withPageConfig(page, payload));
    if ("error" in result) return { error: describeError(result) };
    return { account: result.account };
  };

  const saveDisclosure = async (text: string) => {
    const result = await updateFacebookPageAction(page.id, withPageConfig(page, { automationDisclosure: text }));
    if ("error" in result) return { error: describeError(result) };
    if (!result.account) return {};
    onUpdated(result.account);
    return { saved: result.account.automationDisclosure };
  };

  return (
    <div className="space-y-6">
      <ChannelAutomationPanel<FacebookPage>
        account={page}
        onUpdated={onUpdated}
        onSave={save}
        translationNamespace="facebook.automation"
        controlId="fb-automation-enabled"
        showHandling
        dealEntryType="facebook"
      />
      <AutomationDisclosureEditor value={page.automationDisclosure} translationNamespace="facebook.automation" onSave={saveDisclosure} />
    </div>
  );
}
