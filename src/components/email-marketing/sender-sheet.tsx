"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { createEmailSenderAction, updateEmailSenderAction } from "@/app/actions/email-marketing";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetFooter, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ChatCircleDots } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { EmailDomain, EmailSender } from "@/lib/email-marketing/types";

interface SenderDraft {
  domainId: string;
  localPart: string;
  displayName: string;
  forward: string;
  isDefault: boolean;
}

function draftOf(sender: EmailSender | null, domains: EmailDomain[]): SenderDraft {
  if (sender) {
    return { domainId: sender.domain_id, localPart: sender.local_part, displayName: sender.display_name, forward: sender.reply_forward_to, isDefault: sender.is_default };
  }
  return { domainId: domains[0]?.id ?? "", localPart: "", displayName: "", forward: "", isDefault: false };
}

export function SenderSheet({
  sender,
  domains,
  onClose,
  onSaved,
}: {
  sender: EmailSender | null;
  domains: EmailDomain[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("emailMarketing.senderForm");
  const tm = useTranslations("emailMarketing");
  const describe = useEmailError();
  const [draft, setDraft] = useState<SenderDraft>(() => draftOf(sender, domains));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = sender !== null;
  const selectedDomain = domains.find((domain) => domain.id === draft.domainId);
  const patch = (next: Partial<SenderDraft>) => setDraft((current) => ({ ...current, ...next }));

  const save = async () => {
    setSaving(true);
    setError(null);
    const input = {
      domain_id: draft.domainId,
      local_part: draft.localPart.trim(),
      display_name: draft.displayName.trim(),
      reply_forward_to: draft.forward.trim(),
      is_default: draft.isDefault,
    };
    const result = editing ? await updateEmailSenderAction(sender.id, input) : await createEmailSenderAction(input);
    setSaving(false);
    if (isActionError(result)) {
      setError(describe(result));
      return;
    }
    toast.success(editing ? t("updated", { address: result.data.address }) : t("created", { address: result.data.address }));
    onSaved();
  };

  return (
    <ElevatedSheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedSheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{editing ? t("editTitle") : t("createTitle")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("description")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>

        <form
          id="email-sender-form"
          className="space-y-4 px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {domains.length === 0 ? (
            <Notice tone="warning" title={t("noDomainTitle")}>
              <p>{t("noDomainText")}</p>
            </Notice>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-center gap-2">
            <ElevatedInput label={t("localPart")} placeholder=" " value={draft.localPart} onChange={(event) => patch({ localPart: event.target.value })} autoComplete="off" spellCheck={false} required />
            <span aria-hidden="true" className="text-sm font-semibold text-muted-foreground">@</span>
            <ElevatedSelect label={t("domain")} value={draft.domainId} onValueChange={(value) => patch({ domainId: value })}>
              {domains.map((domain) => (
                <ElevatedSelectItem key={domain.id} value={domain.id}>
                  {domain.domain}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {selectedDomain && draft.localPart.trim() ? t("preview", { address: `${draft.localPart.trim()}@${selectedDomain.domain}` }) : t("localPartHelp")}
          </p>

          <ElevatedInput label={t("displayName")} placeholder=" " value={draft.displayName} onChange={(event) => patch({ displayName: event.target.value })} maxLength={80} />
          <p className="-mt-2 text-xs text-muted-foreground">{t("displayNameHelp")}</p>

          <ElevatedInput label={t("forward")} placeholder=" " type="email" value={draft.forward} onChange={(event) => patch({ forward: event.target.value })} autoComplete="off" />
          <div className="-mt-1 flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <ChatCircleDots aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
            <p>{t("forwardHelp")}</p>
          </div>

          <label className="flex items-start justify-between gap-4 rounded-[--radius] border border-border px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium text-foreground">{t("default")}</span>
              <span className="block text-xs text-muted-foreground">{t("defaultHelp")}</span>
            </span>
            <ElevatedSwitch checked={draft.isDefault} onCheckedChange={(checked) => patch({ isDefault: checked })} aria-label={t("default")} />
          </label>

          {error ? (
            <Notice tone="fault" title={t("failed")}>
              <p>{error}</p>
            </Notice>
          ) : null}
        </form>

        <ElevatedSheetFooter className="flex-row flex-wrap justify-end gap-2 border-t border-border">
          <Button variant="outline" title={tm("common.cancel")} onClick={onClose} />
          <Button type="submit" form="email-sender-form" title={saving ? t("saving") : t("save")} disabled={saving || domains.length === 0 || draft.localPart.trim() === "" || draft.domainId === ""} />
        </ElevatedSheetFooter>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
