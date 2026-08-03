"use client";

import { ArrowLeft, Check, Copy, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { connectTelegramAccountAction } from "@/app/actions/telegram";
import { looksLikeBotToken } from "@/lib/telegram/types";

import Button from "@/components/elevated-design/button";
import {
  ConnectBlock,
  ConnectFacts,
  ConnectIdentity,
  ConnectNotice,
  ConnectPanel,
  ConnectResult,
  ConnectShell,
  ConnectTrack,
  ConnectTrackStep,
} from "@/components/channels/connect-layout";
import { TelegramLogoColor } from "@/components/icons/channel-logos";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Connecting a Telegram bot: the direct flow.
 *
 * Unlike WhatsApp and Instagram, nothing here hands off to a provider popup.
 * The operator does real work in another application (BotFather), comes back
 * with a token, and finishes on this page. That makes the token field a stop on
 * the same rail as the instructions rather than a form sitting beside them: it
 * cannot be completed until the three stops above it are done, and putting it
 * anywhere else invites a paste the operator has nothing to paste yet.
 */
export default function ConnectTelegramPage() {
  const t = useTranslations("telegram");
  const tc = useTranslations("channels.connect");
  const router = useRouter();
  const { toast } = useToast();
  const { can } = useWorkspace();

  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ name: string } | null>(null);

  // Permission is enforced server-side too; this only avoids showing a flow the
  // operator cannot finish.
  useEffect(() => {
    if (!can("telegram_accounts", "create")) {
      router.replace("/dashboard/telegram-accounts");
    }
  }, [can, router]);

  const trimmed = token.trim();
  // Checked before the round trip: BotFather issues `<bot_id>:<secret>`, and a
  // paste that is not that shape is almost always the bot's @username or the
  // token with surrounding chat text still attached.
  const tokenLooksValid = useMemo(() => looksLikeBotToken(trimmed), [trimmed]);
  const showMalformed = trimmed !== "" && !tokenLooksValid;

  const handleSubmit = useCallback(async () => {
    if (!tokenLooksValid || submitting) return;

    setSubmitting(true);
    setError(null);
    const result = await connectTelegramAccountAction({ botToken: trimmed });
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      toast({
        title: t("connect.errorTitle"),
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    // Held on the page rather than redirected away. The operator has just
    // finished a multi-application task and deserves to see it land, plus the
    // bot's resolved name is the only confirmation that the right token was
    // pasted.
    const name = result.account?.displayName ?? "";
    setToken("");
    setConnected({ name });
    toast({
      title: t("connect.successTitle"),
      description: t("notice.connected", { username: name }),
    });
  }, [tokenLooksValid, submitting, trimmed, toast, t]);

  // "Ativo na hora" used to lead this list and restated `heroNote`, the notice
  // directly above it, almost word for word. The notice is the pre-existing
  // string and the more prominent placement, so the duplicate fact went.
  const facts = [
    {
      term: t("connect.facts.secure.title"),
      detail: t("connect.facts.secure.description"),
    },
    {
      term: t("connect.facts.inbox.title"),
      detail: t("connect.facts.inbox.description"),
    },
  ];

  return (
    <ConnectShell>
      <ConnectBlock>
        <Button
          variant="ghost"
          title={t("connect.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/telegram-accounts")}
        />
      </ConnectBlock>

      <ConnectIdentity
        logo={<TelegramLogoColor className="h-7 w-7" />}
        title={t("connect.title")}
        lead={t("connect.description")}
      />

      {connected ? (
        <ConnectResult
          status="success"
          title={t("connect.successTitle")}
          body={t("connect.resultBody")}
          details={
            connected.name
              ? [{ label: t("connect.detailBot"), value: connected.name }]
              : undefined
          }
          actions={
            <>
              <Button
                variant="primary"
                title={tc("goToInbox")}
                onClick={() => router.push("/dashboard/live-chat")}
              />
              <Button
                variant="outline-subtle"
                title={t("connect.viewBots")}
                onClick={() => router.push("/dashboard/telegram-accounts")}
              />
            </>
          }
        />
      ) : (
        <ConnectPanel>
          <ConnectTrack>
            <ConnectTrackStep index={1} text={t("connect.step1")}>
              <CommandChip value="/newbot" />
            </ConnectTrackStep>
            <ConnectTrackStep index={2} text={t("connect.step2")} />
            <ConnectTrackStep index={3} text={t("connect.step3")} />

            <ConnectTrackStep
              index={4}
              isAction
              isLast
              title={t("connect.actionTitle")}
              text={t("connect.tokenHelp")}
            >
              <div className="space-y-3">
                <label htmlFor="telegram-token" className="sr-only">
                  {t("connect.tokenLabel")}
                </label>
                <input
                  id="telegram-token"
                  type="password"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="123456789:AA…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSubmit();
                  }}
                  aria-invalid={showMalformed || Boolean(error)}
                  aria-describedby={
                    showMalformed
                      ? "telegram-token-hint"
                      : error
                        ? "telegram-token-error"
                        : undefined
                  }
                  className={cn(
                    "w-full rounded-xl border bg-background px-4 py-3 font-mono text-sm text-foreground",
                    "placeholder:font-sans placeholder:text-foreground/55",
                    "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    showMalformed || error
                      ? "border-destructive/60 focus-visible:ring-destructive/30"
                      : "border-border focus:border-primary/60",
                  )}
                />

                {/* Reserved so the block does not jump when validation appears
                    under a field the operator is still typing into. */}
                <div className="min-h-[1.25rem]">
                  {showMalformed && (
                    <p
                      id="telegram-token-hint"
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground"
                    >
                      <Warning
                        weight="fill"
                        className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-500"
                      />
                      {t("connect.tokenMalformed")}
                    </p>
                  )}
                  {!showMalformed && error && (
                    <p
                      id="telegram-token-error"
                      role="alert"
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground"
                    >
                      <Warning
                        weight="fill"
                        className="mt-px size-3.5 shrink-0 text-destructive"
                      />
                      {error}
                    </p>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  title={submitting ? t("connect.connecting") : t("connect.submit")}
                  onClick={() => void handleSubmit()}
                  disabled={!tokenLooksValid}
                  aria-busy={submitting}
                  className="w-full sm:w-auto sm:px-10"
                />
              </div>
            </ConnectTrackStep>
          </ConnectTrack>
        </ConnectPanel>
      )}

      {!connected && (
        <>
          <ConnectBlock>
            <ConnectNotice tone="info">{t("connect.heroNote")}</ConnectNotice>
          </ConnectBlock>
          <ConnectFacts title={tc("whatYouGet")} items={facts} />
        </>
      )}
    </ConnectShell>
  );
}

/** A copyable command. Typing `/newbot` by hand is a needless failure point. */
function CommandChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {copied ? (
        <Check weight="bold" className="size-3.5 text-emerald-600 dark:text-emerald-500" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
      {value}
    </button>
  );
}
