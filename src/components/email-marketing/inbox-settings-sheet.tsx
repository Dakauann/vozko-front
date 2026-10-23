"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getEmailInboxAction } from "@/app/actions/email-inboxes";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { EmailInboxSettingsPanel } from "@/components/email-marketing/inbox-settings-panel";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { Notice } from "@/components/ui/notice";
import type { EmailSender } from "@/lib/email-marketing/types";
import type { EmailInbox } from "@/lib/email/types";

type Loaded = { inbox: EmailInbox } | { error: string } | null;

export function InboxSettingsSheet({ sender, onClose }: { sender: EmailSender; onClose: () => void }) {
  const t = useTranslations("emailMarketing.inboxSettings");
  const describe = useEmailError();
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let active = true;
    void getEmailInboxAction(sender.id).then((result) => {
      if (!active) return;
      if ("error" in result || !result.inbox) {
        setLoaded({ error: describe(result) });
        return;
      }
      setLoaded({ inbox: result.inbox });
    });
    return () => {
      active = false;
    };
  }, [sender.id, describe]);

  return (
    <ElevatedSheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <ElevatedSheetHeader className="space-y-1 border-b border-border pr-16">
          <ElevatedSheetTitle className="text-xl">{t("sheetTitle")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("sheetDescription", { address: sender.address })}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {loaded === null ? (
            <ScreenLoader fit="fill" />
          ) : "error" in loaded ? (
            <Notice tone="fault">
              <p>{loaded.error}</p>
            </Notice>
          ) : (
            <EmailInboxSettingsPanel inbox={loaded.inbox} onSaved={(inbox) => setLoaded({ inbox })} />
          )}
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
