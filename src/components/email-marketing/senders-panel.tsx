"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { deleteEmailSenderAction, updateEmailSenderAction } from "@/app/actions/email-marketing";
import { InboxSettingsSheet } from "@/components/email-marketing/inbox-settings-sheet";
import { SenderSheet } from "@/components/email-marketing/sender-sheet";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { EnvelopeSimple, Headset, PencilSimple, Plus, Star, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { sendableDomains } from "@/lib/email-marketing/ladder";
import { isSettingUp } from "@/lib/email-marketing/setup-progress";
import type { EmailDomainLifecycle, EmailSender, EmailSetup } from "@/lib/email-marketing/types";

type Editing = { sender: EmailSender | null } | null;

const DOMAIN_GONE_CHIP: Record<Exclude<EmailDomainLifecycle, "active">, "domainReleasingChip" | "domainRetiredChip"> = {
  releasing: "domainReleasingChip",
  retired: "domainRetiredChip",
};

function DomainGoneNotices({ senders }: { senders: readonly EmailSender[] }) {
  const t = useTranslations("emailMarketing.senders");
  const releasing = senders.some((sender) => sender.domain_lifecycle === "releasing");
  const retired = senders.some((sender) => sender.domain_lifecycle === "retired");
  if (!releasing && !retired) return null;
  return (
    <div className="space-y-3">
      {releasing ? (
        <Notice tone="warning" title={t("domainReleasingTitle")}>
          <p>{t("domainReleasingText")}</p>
        </Notice>
      ) : null}
      {retired ? (
        <Notice tone="warning" title={t("domainRetiredTitle")}>
          <p>{t("domainRetiredText")}</p>
        </Notice>
      ) : null}
    </div>
  );
}

export function SendersPanelBody({ setup, canConfigure, onChanged }: { setup: EmailSetup; canConfigure: boolean; onChanged: () => void }) {
  const t = useTranslations("emailMarketing.senders");
  const tm = useTranslations("emailMarketing");
  const describe = useEmailError();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<EmailSender | null>(null);
  const [attending, setAttending] = useState<EmailSender | null>(null);
  const canReadInbox = useSettledPermission("email_inboxes", "read");
  const domains = sendableDomains(setup);

  const makeDefault = async (sender: EmailSender) => {
    const result = await updateEmailSenderAction(sender.id, { is_default: true });
    if (isActionError(result)) {
      toast.error(describe(result));
      return;
    }
    toast.success(t("defaultSet", { address: sender.address }));
    onChanged();
  };

  const remove = async () => {
    if (!deleting) return true;
    const result = await deleteEmailSenderAction(deleting.id);
    if (isActionError(result)) {
      toast.error(describe(result));
      return false;
    }
    toast.success(t("deleted", { address: deleting.address }));
    onChanged();
    return true;
  };

  const columns: DashboardTableColumn<EmailSender>[] = [
    {
      header: t("columns.address"),
      key: "address",
      render: (sender) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{sender.display_name || <EmptyValue />}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{sender.address}</p>
          {sender.domain_lifecycle === "active" ? null : <StatusChip tone="warning" className="mt-1.5" label={t(DOMAIN_GONE_CHIP[sender.domain_lifecycle])} />}
        </div>
      ),
    },
    {
      header: t("columns.forward"),
      key: "forward",
      render: (sender) => (sender.reply_forward_to ? <span className="font-mono text-xs text-foreground">{sender.reply_forward_to}</span> : <span className="text-xs text-muted-foreground">{t("inboxOnly")}</span>),
    },
    {
      header: t("columns.default"),
      key: "default",
      render: (sender) => (sender.is_default ? <StatusChip tone="outline" icon={<Star className="h-3 w-3" weight="fill" />} label={t("defaultChip")} /> : null),
    },
    ...(canConfigure || canReadInbox
      ? [
          {
            header: t("columns.actions"),
            key: "actions",
            className: "text-right",
            render: (sender: EmailSender) => (
              <div className="flex items-center justify-end gap-1">
                {canReadInbox ? (
                  <Button size="sm" variant="ghost" icon={<Headset className="h-3.5 w-3.5" weight="bold" />} iconVisible title={t("inboxAction")} aria-label={t("configureInbox", { address: sender.address })} onClick={() => setAttending(sender)} />
                ) : null}
                {!canConfigure || sender.is_default || sender.domain_lifecycle !== "active" ? null : <Button size="sm" variant="ghost" title={t("makeDefault")} onClick={() => void makeDefault(sender)} />}
                {canConfigure && sender.domain_lifecycle === "active" ? (
                  <Button size="sm" variant="ghost" icon={<PencilSimple className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("edit", { address: sender.address })} onClick={() => setEditing({ sender })} />
                ) : null}
                {canConfigure ? (
                  <Button size="sm" variant="ghost" icon={<Trash className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("delete", { address: sender.address })} onClick={() => setDeleting(sender)} />
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <DomainGoneNotices senders={setup.senders} />
      <DashboardTable<EmailSender>
        data={setup.senders}
        columns={columns}
        rowKey={(sender) => sender.id}
        headerRight={
          canConfigure ? (
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" weight="bold" />} iconVisible title={t("create")} onClick={() => setEditing({ sender: null })} disabled={domains.length === 0} />
          ) : undefined
        }
        emptyState={{
          icon: <EnvelopeSimple className="h-7 w-7 text-muted-foreground" weight="fill" />,
          title: t("emptyTitle"),
          description: domains.length > 0 ? t("emptyText") : isSettingUp(setup.setup) ? tm("setup.sendersWaiting") : t("emptyWaiting"),
        }}
      />
      {editing ? (
        <SenderSheet
          sender={editing.sender}
          domains={domains}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
      {attending ? <InboxSettingsSheet sender={attending} onClose={() => setAttending(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={t("deleteTitle", { address: deleting?.address ?? "" })}
        description={t("deleteText")}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={tm("common.cancel")}
        onConfirm={remove}
      />
    </div>
  );
}
