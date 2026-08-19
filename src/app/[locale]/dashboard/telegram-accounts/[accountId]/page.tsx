"use client";

import {
  ArrowClockwise,
  ArrowLeft,
  CheckCircle,
  Copy,
  LinkSimple,
  Plus,
  TelegramLogo,
  Trash,
  Warning,
} from "@/components/icons";
import { useCallback, useEffect, useState } from "react";

import {
  createTelegramDeepLinkAction,
  deleteTelegramDeepLinkAction,
  getTelegramAccountAction,
  listTelegramDeepLinksAction,
  reregisterTelegramWebhookAction,
} from "@/app/actions/telegram";
import {
  telegramAccountIssue,
  type TelegramAccount,
  type TelegramDeepLinkResult,
} from "@/lib/telegram/types";

import Button from "@/components/elevated-design/button";
import { TelegramBusinessPanel } from "@/components/telegram/telegram-business-panel";
import { TelegramAutomationPanel } from "@/components/telegram/telegram-automation-panel";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * One Telegram bot.
 *
 * Telegram is an inbox channel: there are no posts and no comment moderation, so
 * this page carries the three things that actually matter here, webhook health,
 * who attends the inbox, and the deep links that are this channel's only way to
 * start an attributed conversation.
 */
export default function TelegramAccountPage() {
  const t = useTranslations("telegram");
  const params = useParams();
  const accountId = String(params?.accountId ?? "");
  const { toast } = useToast();
  const { can } = useWorkspace();

  const [account, setAccount] = useState<TelegramAccount | null>(null);
  const [links, setLinks] = useState<TelegramDeepLinkResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const canUpdate = can("telegram_accounts", "update");

  const load = useCallback(async () => {
    setLoading(true);
    const [accountResult, linksResult] = await Promise.all([
      getTelegramAccountAction(accountId),
      listTelegramDeepLinksAction(accountId),
    ]);
    setLoading(false);

    if (accountResult.error || !accountResult.account) {
      setError(accountResult.error ?? t("profile.notFound"));
      return;
    }
    setError(null);
    setAccount(accountResult.account);
    setLinks(linksResult.links ?? []);
  }, [accountId, t]);

  useEffect(() => {
    if (accountId) void load();
  }, [accountId, load]);

  const handleReregister = useCallback(async () => {
    setBusy(true);
    const result = await reregisterTelegramWebhookAction(accountId);
    setBusy(false);

    if (result.error) {
      toast({ title: t("card.reregister"), description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: t("card.reregister"), description: t("notice.webhookFixed") });
    if (result.account) setAccount(result.account);
  }, [accountId, toast, t]);

  const handleCreateLink = useCallback(async () => {
    setBusy(true);
    const result = await createTelegramDeepLinkAction(accountId, {
      label: newLabel.trim() || undefined,
    });
    setBusy(false);

    if (result.error || !result.link) {
      toast({ title: t("links.createFailed"), description: result.error, variant: "destructive" });
      return;
    }
    setNewLabel("");
    setLinks((prev) => [result.link!, ...prev]);
  }, [accountId, newLabel, toast, t]);

  const handleDeleteLink = useCallback(
    async (token: string) => {
      setBusy(true);
      const result = await deleteTelegramDeepLinkAction(accountId, token);
      setBusy(false);

      if (result.error) {
        toast({ title: t("links.deleteFailed"), description: result.error, variant: "destructive" });
        return;
      }
      setLinks((prev) => prev.filter((l) => l.link.token !== token));
    },
    [accountId, toast, t],
  );

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{t("profile.loading")}</div>;
  }

  if (error || !account) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
        <Warning className="h-4 w-4" />
        {error ?? t("profile.notFound")}
      </div>
    );
  }

  const issue = telegramAccountIssue(account);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        badge={account.displayName}
        description={t("profile.description")}
        icon={<TelegramLogo className="h-6 w-6" weight="fill" />}
        colorClass="text-info-ink"
        actions={
          <Link href="/dashboard/telegram-accounts">
            <Button
              variant="ghost"
              title={t("profile.back")}
              icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
              iconVisible
              iconSide="left"
            />
          </Link>
        }
      />

      {/* Webhook health leads the page because it is the only thing here that
          silently destroys data: Telegram discards undelivered updates after 24
          hours and offers no history API to recover them. */}
      <ElevatedContainer className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t("profile.webhookTitle")}</h2>
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
              account.webhookHealthy
                ? "bg-healthy text-healthy-foreground"
                : "bg-warning text-warning-foreground",
            )}
          >
            {account.webhookHealthy ? t("webhook.healthy") : t("webhook.failing")}
          </span>
        </div>

        {issue === "webhook" && (
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed text-foreground">
            <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning-ink dark:text-warning-ink" />
            <span>
              {t("profile.webhookLosingMessages")}
              {account.webhookLastError ? `, ${account.webhookLastError}` : ""}
            </span>
          </p>
        )}

        {issue === "token" && (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed text-destructive-ink">
            <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {t("profile.tokenInvalidHelp")}
          </p>
        )}

        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label={t("profile.mode")} value={t(`mode.${account.mode.toLowerCase()}`)} />
          <Field
            label={t("profile.pending")}
            value={String(account.webhookPendingCount)}
            tone={account.webhookPendingCount > 0 ? "warn" : undefined}
          />
          <Field
            label={t("profile.registeredAt")}
            value={
              account.webhookSetAt
                ? new Date(account.webhookSetAt).toLocaleString()
                : t("profile.never")
            }
          />
        </dl>

        {canUpdate && (
          <Button
            variant="secondary"
            title={t("card.reregister")}
            icon={
              <ArrowClockwise weight="bold" className={cn("h-4 w-4", busy && "animate-spin")} />
            }
            iconVisible
            iconSide="left"
            onClick={() => void handleReregister()}
            disabled={busy}
          />
        )}
      </ElevatedContainer>

      {/* Who attends this inbox. Agent and workflow attendance run through the
          same channel-agnostic services every other channel uses, so the panel is
          the shared one. */}
      <TelegramAutomationPanel account={account} onUpdated={setAccount} />

      {/* Business pairing. Placed after automation because it changes HOW the
          agent appears, not whether it runs, and because its most important
          job is the can_reply warning, which only matters once an agent is
          actually attending. */}
      <TelegramBusinessPanel account={account} />

      {/* Deep links: the channel's substitute for cold outbound. A bot cannot
          message a customer first, but a link opens an already-attributed
          conversation on the customer's first tap. */}
      <ElevatedContainer className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{t("links.title")}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("links.help")}</p>
        </div>

        {canUpdate && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <ElevatedInput
                type="text"
                label={t("links.labelField")}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateLink();
                }}
                controlSize="sm"
                className="w-full"
              />
            </div>
            <Button
              variant="primary"
              title={t("links.create")}
              icon={<Plus weight="bold" className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={() => void handleCreateLink()}
              disabled={busy}
            />
          </div>
        )}

        {links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            {t("links.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {links.map(({ link, url }) => (
              <li key={link.token} className="flex items-center gap-3 px-4 py-3">
                <LinkSimple className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {link.label || t("links.untitled")}
                  </p>
                  <p className="truncate font-mono text-2xs text-muted-foreground">{url}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {t("links.uses", { count: link.useCount })}
                </span>
                <CopyButton value={url} label={t("links.copy")} />
                {canUpdate && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDeleteLink(link.token)}
                    title={t("links.delete")}
                    className="inline-flex shrink-0 items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink disabled:opacity-50"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </ElevatedContainer>
    </motion.div>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium tabular-nums",
          tone === "warn" ? "text-warning-ink dark:text-warning-ink" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={label}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex shrink-0 items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <CheckCircle weight="fill" className="h-4 w-4 text-healthy-ink" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
