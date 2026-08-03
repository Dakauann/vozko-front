"use client";

import { CheckCircle, Info, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { TelegramAccount } from "@/lib/telegram/types";

/**
 * Telegram Business pairing.
 *
 * Two states share this panel because they are the same question asked at two
 * moments: "how do I stop looking like a bot?" and "why is nothing sending?".
 *
 * The second is the one that costs money. An account can be paired and look
 * entirely healthy while every send is withheld, because the owner granted the
 * connection but not the reply permission. Nothing in Telegram surfaces that,
 * and the backend correctly refuses to send, so this is the only place an
 * operator can find out.
 */
export function TelegramBusinessPanel({ account }: { account: TelegramAccount }) {
  const t = useTranslations("telegram.business");
  const isBusiness = account.mode?.toUpperCase() === "BUSINESS";
  const canReply = account.businessRights?.can_reply === true;

  return (
    <ElevatedContainer className="space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("description")}</p>
      </div>

      {isBusiness ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
            <CheckCircle weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
            <span>
              {account.businessUsername
                ? t("pairedTo", { username: `@${account.businessUsername}` })
                : t("paired")}
            </span>
          </p>

          {/* The silent-failure case. Everything reads as connected; every send
              is refused. It outranks the connection notice above in urgency, so
              it is styled as a fault rather than a hint. */}
          {!canReply && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
              <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              {t("noReplyRight")}
            </p>
          )}

          {account.businessEnabled === false && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
              <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              {t("disabled")}
            </p>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
            <Info weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-500" />
            {t("windowNote")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Numbered because it is a sequence performed on a phone, away from
              this screen, the operator needs to hold their place in it. */}
          <ol className="space-y-2.5">
            {[t("step1"), t("step2"), t("step3"), t("step4")].map((step, i) => (
              <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5">
                  {i === 2 && account.botUsername ? (
                    <>
                      {step}{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                        @{account.botUsername}
                      </code>
                    </>
                  ) : (
                    step
                  )}
                </span>
              </li>
            ))}
          </ol>

          <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
            <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
            {t("tradeoff")}
          </p>
        </div>
      )}
    </ElevatedContainer>
  );
}
