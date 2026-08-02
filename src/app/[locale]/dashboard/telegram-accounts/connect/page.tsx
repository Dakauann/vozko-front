"use client";

import { ArrowLeft, Check, Copy, Info, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { connectTelegramAccountAction } from "@/app/actions/telegram";
import { looksLikeBotToken } from "@/lib/telegram/types";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import {
  ConnectAsideCard,
  ConnectWorkArea,
} from "@/components/channels/connect-layout";
import Image from "next/image";
import { TelegramLogoColor } from "@/components/icons/channel-logos";
import { cn } from "@/lib/utils";
import { getBrand } from "@/config/brand";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Connecting a Telegram bot.
 *
 * Structurally this page is a SEQUENCE, not a form beside some help. The operator
 * has to leave for BotFather, obtain a token, and come back — so the token field
 * cannot be filled until the instructions have been followed. A two-column layout
 * presented those as peers and let the eye land on a field the visitor had no way
 * to complete yet.
 *
 * So the whole page is one ordered path, and the field is the last step on the
 * same numbered rail. Reading order, DOM order and task order are the same order.
 * The numbering is earned here: it is a strict prerequisite chain, not decoration.
 */
export default function ConnectTelegramPage() {
  const t = useTranslations("telegram");
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const { can } = useWorkspace();

  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    toast({
      title: t("connect.successTitle"),
      description: t("notice.connected", { username: result.account?.displayName ?? "" }),
    });
    router.push("/dashboard/telegram-accounts");
  }, [tokenLooksValid, submitting, trimmed, toast, t, router]);

  const brandLogoSrc =
    resolvedTheme === "dark" ? getBrand().logo.markWhite : getBrand().logo.mark;

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto w-full max-w-6xl space-y-6 pb-16"
    >
      <motion.div variants={itemVariants}>
        <Button
          variant="ghost"
          title={t("connect.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/telegram-accounts")}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <ElevatedContainer className="relative overflow-hidden p-8 sm:p-10">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#229ED9]/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
              className="relative"
            >
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)]">
                <TelegramLogoColor className="h-8 w-8" />
              </div>
            </motion.div>

            <div className="h-px w-6 bg-border" />

            <motion.div
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.25 }}
              className="relative"
            >
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)]">
                <Image
                  src={brandLogoSrc}
                  alt={getBrand().name}
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                  unoptimized
                />
              </div>
            </motion.div>
          </div>

          {/* More space above the heading than below it, so the title binds to its
              own description rather than floating between two blocks. */}
          <div className="mt-8 max-w-xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("connect.title")}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {t("connect.description")}
            </p>
          </div>

        </ElevatedContainer>
      </motion.div>

      <ConnectWorkArea
        aside={
          <ConnectAsideCard title={t("connect.asideTitle")} icon={<Info className="h-3.5 w-3.5" />}>
            {/* The single fact that makes this flow different from the Meta
                channels: there is no approval step to go looking for. It lives
                here rather than in the hero because an operator re-reads it
                while working through the steps, not before starting them. */}
            <p>{t("connect.heroNote")}</p>
          </ConnectAsideCard>
        }
        work={
        <ElevatedContainer className="p-6 sm:p-8">
          {/* One ordered list, one rail. The numbers are load-bearing: each step
              is a hard prerequisite for the next. */}
          <ol className="space-y-8">
            <Step index={1} text={t("connect.step1")} command="/newbot" />
            <Step index={2} text={t("connect.step2")} />
            <Step index={3} text={t("connect.step3")} />

            <Step index={4} isLast>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("connect.tokenTitle")}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("connect.tokenHelp")}
                </p>
              </div>

              <div className="mt-5 space-y-3">
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
                    showMalformed ? "telegram-token-hint" : error ? "telegram-token-error" : undefined
                  }
                  className={cn(
                    "w-full rounded-xl border bg-background px-4 py-3 font-mono text-sm text-foreground",
                    "placeholder:font-sans placeholder:text-muted-foreground",
                    "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    showMalformed || error
                      ? "border-amber-500/60 focus-visible:ring-amber-500/30"
                      : "border-border focus:border-primary/60",
                  )}
                />

                {/* Reserved so the block does not jump when validation appears
                    under a field the operator is still typing into. */}
                <div className="min-h-[1.25rem]">
                  {showMalformed && (
                    <p
                      id="telegram-token-hint"
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
                    >
                      <Warning weight="fill" className="mt-px h-3.5 w-3.5 shrink-0" />
                      {t("connect.tokenMalformed")}
                    </p>
                  )}
                  {!showMalformed && error && (
                    <p
                      id="telegram-token-error"
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-destructive"
                    >
                      <Warning weight="fill" className="mt-px h-3.5 w-3.5 shrink-0" />
                      {error}
                    </p>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  title={submitting ? t("connect.connecting") : t("connect.submit")}
                  onClick={() => void handleSubmit()}
                  disabled={!tokenLooksValid || submitting}
                  className="w-full sm:w-auto sm:px-10"
                />
              </div>
            </Step>
          </ol>
        </ElevatedContainer>
        }
      />
    </motion.main>
  );
}

/**
 * One step on the shared numbered rail.
 *
 * The connecting line is drawn from the marker rather than between siblings, so a
 * step whose body is a whole form still reads as part of the same sequence — the
 * rail grows with the content instead of assuming equal-height rows.
 */
function Step({
  index,
  text,
  command,
  isLast,
  children,
}: {
  index: number;
  text?: string;
  command?: string;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4">
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            isLast
              ? "bg-[#229ED9] text-white"
              : "bg-[#1B7FAD] text-white",
          )}
        >
          {index}
        </span>
        {!isLast && <span aria-hidden className="mt-2 w-px flex-1 bg-border" />}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        {text && <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>}
        {command && <CommandChip value={command} />}
        {children}
      </div>
    </li>
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
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {copied ? (
        <Check weight="bold" className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      {value}
    </button>
  );
}
