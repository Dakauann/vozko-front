"use client";

import {
  ArrowLeft,
  ChatCircleDots,
  ClipboardText,
  Code,
  Headset,
  PaperPlaneTilt,
  Robot,
  X,
} from "@/components/icons";
import { useCallback, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { SupportInbox } from "@/lib/support-inboxes/types";
import { getBrand } from "@/config/brand";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

interface SupportInboxDetailProps {
  inbox: SupportInbox;
  agentName?: string;
}

export default function SupportInboxDetail({
  inbox,
  agentName,
}: SupportInboxDetailProps) {
  const t = useTranslations("supportInboxesPage.detail");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);

  const embedSnippet = useMemo(() => {
    const brand = getBrand();
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    return `<!-- ${brand.name} Support Widget -->
<script>
  (function() {
    var w = document.createElement('script');
    w.src = '${apiBase}/public/support/widget.js';
    w.async = true;
    w.dataset.inboxId = '${inbox.id}';
    w.dataset.color = '${inbox.widgetColor || "#7c3aed"}';
    document.head.appendChild(w);
  })();
</script>`;
  }, [inbox.id, inbox.widgetColor]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [embedSnippet]);

  const widgetColor = inbox.widgetColor || "#7c3aed";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      {/* Back button */}
      <motion.div variants={itemVariants}>
        <Button
          variant="ghost"
          title={t("back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/support-inboxes")}
        />
      </motion.div>

      {/* Header */}
      <motion.header variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[--radius] text-white shadow-lg"
            style={{ backgroundColor: widgetColor }}
          >
            <Headset weight="fill" className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{inbox.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t("createdAt", {
                date: new Date(inbox.createdAt).toLocaleDateString(),
              })}
            </p>
          </div>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column: Settings summary + embed code */}
        <div className="space-y-6">
          {/* Settings Summary */}
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">
                {t("settingsTitle")}
              </h3>

              <div className="space-y-3">
                <InfoRow label={t("name")} value={inbox.name} />

                <InfoRow
                  label={t("greeting")}
                  value={inbox.greetingMessage || t("noGreeting")}
                />

                <InfoRow
                  label={t("aiAgent")}
                  value={
                    inbox.enableAgentResponses
                      ? agentName || t("agentEnabled")
                      : t("agentDisabled")
                  }
                  icon={
                    inbox.enableAgentResponses ? (
                      <Robot
                        className="h-4 w-4 text-healthy"
                        weight="fill"
                      />
                    ) : undefined
                  }
                />

                <InfoRow
                  label={t("widgetColor")}
                  value={
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: widgetColor }}
                      />
                      <span className="text-xs font-mono text-muted-foreground">
                        {widgetColor}
                      </span>
                    </div>
                  }
                />

                <InfoRow
                  label={t("origins")}
                  value={
                    inbox.allowedOrigins.length === 0
                      ? t("allOrigins")
                      : inbox.allowedOrigins.join(", ")
                  }
                />

                {inbox.preChatFields && inbox.preChatFields.length > 0 && (
                  <div className="pt-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("preChatFields")}
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {inbox.preChatFields.map((field) => (
                        <div
                          key={field.name}
                          className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
                        >
                          <span className="text-foreground">{field.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-[--radius] bg-background px-2 py-0.5 text-xs text-muted-foreground">
                              {field.type}
                            </span>
                            {field.required && (
                              <span className="text-xs font-medium text-destructive">
                                {t("required")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ElevatedContainer>
          </motion.div>

          {/* Embed Code */}
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="space-y-4">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-violet-500" weight="bold" />
                <h3 className="text-lg font-semibold text-foreground">
                  {t("embedTitle")}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("embedDescription")}
              </p>

              <div className="relative">
                <pre className="overflow-x-auto rounded-[--radius] border border-border bg-muted p-4 text-xs text-foreground font-mono leading-relaxed">
                  {embedSnippet}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ClipboardText className="h-3.5 w-3.5" weight="bold" />
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </ElevatedContainer>
          </motion.div>
        </div>

        {/* Right column: Widget Preview */}
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("previewTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("previewDescription")}
            </p>

            {/* Mock website background */}
            <div className="relative min-h-[500px] overflow-hidden rounded-[--radius] border border-border bg-muted dark:from-slate-900 dark:to-slate-800">
              {/* Fake website content */}
              <div className="p-6 space-y-4">
                <div className="h-4 w-48 rounded-full bg-muted dark:bg-muted" />
                <div className="h-3 w-full rounded-full bg-muted dark:bg-muted" />
                <div className="h-3 w-3/4 rounded-full bg-muted dark:bg-muted" />
                <div className="h-3 w-5/6 rounded-full bg-muted dark:bg-muted" />
                <div className="mt-6 h-32 rounded-[--radius] bg-muted dark:bg-muted" />
                <div className="h-3 w-2/3 rounded-full bg-muted dark:bg-muted" />
                <div className="h-3 w-full rounded-full bg-muted dark:bg-muted" />
              </div>

              {/* Chat widget - Floating Bubble */}
              {!widgetOpen && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  type="button"
                  onClick={() => setWidgetOpen(true)}
                  className="absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-110"
                  style={{ backgroundColor: widgetColor }}
                >
                  <ChatCircleDots className="h-7 w-7" weight="fill" />
                </motion.button>
              )}

              {/* Chat widget - Open Panel */}
              {widgetOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute bottom-5 right-5 flex w-80 flex-col overflow-hidden rounded-[--radius] border border-border bg-card shadow-2xl"
                  style={{ maxHeight: "440px" }}
                >
                  {/* Chat Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 text-white"
                    style={{ backgroundColor: widgetColor }}
                  >
                    <div className="flex items-center gap-2">
                      <Headset className="h-5 w-5" weight="fill" />
                      <div>
                        <p className="text-sm font-semibold">{inbox.name}</p>
                        <p className="text-xs opacity-80">
                          {t("previewOnline")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWidgetOpen(false)}
                      className="rounded-lg p-1 transition-colors hover:bg-white/20"
                    >
                      <X className="h-4 w-4" weight="bold" />
                    </button>
                  </div>

                  {/* Pre-Chat Fields Preview */}
                  {inbox.preChatFields && inbox.preChatFields.length > 0 ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {t("previewPreChatIntro")}
                      </p>
                      {inbox.preChatFields.map((field) => (
                        <div key={field.name} className="space-y-1">
                          <label className="text-xs font-medium text-foreground">
                            {field.label}
                            {field.required && (
                              <span className="ml-1 text-destructive">*</span>
                            )}
                          </label>
                          {field.type === "textarea" ? (
                            <div className="h-16 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground" />
                          ) : field.type === "select" ? (
                            <div className="flex h-9 items-center rounded-lg border border-border bg-muted px-3 text-xs text-muted-foreground">
                              {t("previewSelect")}
                            </div>
                          ) : (
                            <div className="flex h-9 items-center rounded-lg border border-border bg-muted px-3 text-xs text-muted-foreground">
                              {field.type === "email"
                                ? "email@example.com"
                                : field.label}
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: widgetColor }}
                      >
                        {t("previewStart")}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Messages area */}
                      <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {inbox.greetingMessage && (
                          <div className="flex gap-2">
                            <div
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white"
                              style={{ backgroundColor: widgetColor }}
                            >
                              <Headset className="h-3.5 w-3.5" weight="fill" />
                            </div>
                            <div className="max-w-[220px] rounded-[--radius] rounded-tl-sm bg-muted px-3.5 py-2 text-sm text-foreground">
                              {inbox.greetingMessage}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input area */}
                      <div className="border-t border-border p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-[--radius] border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
                            {t("previewPlaceholder")}
                          </div>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors"
                            style={{ backgroundColor: widgetColor }}
                          >
                            <PaperPlaneTilt className="h-4 w-4" weight="fill" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </ElevatedContainer>
        </motion.div>
      </div>
    </motion.div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm font-medium text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 text-sm text-foreground text-right">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
