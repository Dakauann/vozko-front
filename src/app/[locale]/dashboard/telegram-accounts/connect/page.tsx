"use client";

import { ArrowLeft, Check, Copy, Warning } from "@/components/icons";
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

  useEffect(() => {
    if (!can("telegram_accounts", "create")) {
      router.replace("/dashboard/telegram-accounts");
    }
  }, [can, router]);

  const trimmed = token.trim();
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

    const name = result.account?.displayName ?? "";
    setToken("");
    setConnected({ name });
    toast({
      title: t("connect.successTitle"),
      description: t("notice.connected", { username: name }),
    });
  }, [tokenLooksValid, submitting, trimmed, toast, t]);

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
                    "w-full rounded-[--radius] border bg-background px-4 py-3 font-mono text-sm text-foreground",
                    "placeholder:font-sans placeholder:text-foreground/55",
                    "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    showMalformed || error
                      ? "border-destructive/60 focus-visible:ring-destructive/30"
                      : "border-border focus:border-primary/60",
                  )}
                />

                {
}
                <div className="min-h-[1.25rem]">
                  {showMalformed && (
                    <p
                      id="telegram-token-hint"
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground"
                    >
                      <Warning
                        weight="fill"
                        className="mt-px size-3.5 shrink-0 text-warning-ink"
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
                        className="mt-px size-3.5 shrink-0 text-destructive-ink"
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
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {copied ? (
        <Check weight="bold" className="size-3.5 text-healthy-ink" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
      {value}
    </button>
  );
}
