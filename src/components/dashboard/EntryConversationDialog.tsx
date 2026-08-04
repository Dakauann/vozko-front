"use client";

import {
  CaretDown,
  CaretRight,
  ChatCircle,
  Info,
  Phone,
  Robot,
  Spinner,
  User,
  Waveform,
  WhatsappLogo,
  Wrench,
  X,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
  ElevatedDialogTrigger,
} from "@/components/elevated-design/elevated-dialog";
import type {
  EntryConversationAnalysis,
  EntryConversationMessage,
  LeadEntryType,
} from "@/lib/leads/types";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { getEntryConversationAction } from "@/app/actions/leads";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";

interface EntryConversationDialogProps {
  entryId: string;
  entryType: LeadEntryType;
  phoneNumber: string;
  contactName?: string | null;
  trigger?: React.ReactNode;
  translations?: {
    title?: string;
    description?: string;
    loading?: string;
    error?: string;
    noMessages?: string;
    analysis?: {
      title?: string;
      interest?: string;
      disposition?: string;
      sentiment?: string;
      qualification?: string;
      nextAction?: string;
      quality?: string;
      summary?: string;
      interestValues?: {
        interested?: string;
        notInterested?: string;
        undecided?: string;
      };
      dispositionValues?: {
        sale?: string;
        callback?: string;
        declined?: string;
        noAnswer?: string;
        voicemail?: string;
        pending?: string;
      };
      sentimentValues?: {
        positive?: string;
        neutral?: string;
        negative?: string;
      };
      qualificationValues?: {
        hotLead?: string;
        warmLead?: string;
        coldLead?: string;
      };
      nextActionValues?: {
        scheduleCallback?: string;
        sendWhatsapp?: string;
        close?: string;
        escalate?: string;
        continue?: string;
      };
    };
    channels?: {
      voice?: string;
      whatsapp?: string;
    };
    messageTypes?: {
      user_message?: string;
      ai_response?: string;
      tool_call?: string;
      tool_result?: string;
    };
  };
}

function localeTag(locale: string): string {
  if (locale === "pt") return "pt-BR";
  if (locale === "es") return "es-ES";
  if (locale === "de") return "de-DE";
  return "en-US";
}

function formatMessageTime(dateString: string, locale: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAnalysisDate(dateString: string, locale: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const sentimentStyles: Record<string, { bg: string; text: string }> = {
  positive: { bg: "bg-healthy", text: "text-white" },
  neutral: { bg: "bg-muted", text: "text-foreground" },
  negative: { bg: "bg-destructive", text: "text-white" },
};

const qualificationStyles: Record<string, { bg: string; text: string }> = {
  hot_lead: { bg: "bg-destructive", text: "text-white" },
  warm_lead: { bg: "bg-warning", text: "text-white" },
  cold_lead: { bg: "bg-muted", text: "text-white" },
};

function AnalysisPanel({
  analysis,
  translations,
}: {
  analysis: EntryConversationAnalysis;
  translations?: EntryConversationDialogProps["translations"];
}) {
  const locale = useLocale();
  const ti = useTranslations("entryConversation.analysis");
  const t = translations?.analysis ?? {};
  const sentimentStyle =
    sentimentStyles[analysis.sentiment] ?? sentimentStyles.neutral;
  const qualificationStyle =
    qualificationStyles[analysis.qualification] ??
    qualificationStyles.cold_lead;

  const translateInterest = (value: string) => {
    const map: Record<string, string> = {
      interested: t.interestValues?.interested ?? "Interessado",
      not_interested: t.interestValues?.notInterested ?? "Não interessado",
      undecided: t.interestValues?.undecided ?? "Indeciso",
    };
    return map[value] ?? value?.replace(/_/g, " ");
  };

  const translateDisposition = (value: string) => {
    const map: Record<string, string> = {
      sale: t.dispositionValues?.sale ?? "Venda",
      callback: t.dispositionValues?.callback ?? "Retornar ligação",
      declined: t.dispositionValues?.declined ?? "Recusado",
      no_answer: t.dispositionValues?.noAnswer ?? "Sem resposta",
      voicemail: t.dispositionValues?.voicemail ?? "Caixa postal",
      pending: t.dispositionValues?.pending ?? "Pendente",
    };
    return map[value] ?? value?.replace(/_/g, " ");
  };

  const translateSentiment = (value: string) => {
    const map: Record<string, string> = {
      positive: t.sentimentValues?.positive ?? "Positivo",
      neutral: t.sentimentValues?.neutral ?? "Neutro",
      negative: t.sentimentValues?.negative ?? "Negativo",
    };
    return map[value] ?? value?.replace(/_/g, " ");
  };

  const translateQualification = (value: string) => {
    const map: Record<string, string> = {
      hot_lead: t.qualificationValues?.hotLead ?? "Lead quente",
      warm_lead: t.qualificationValues?.warmLead ?? "Lead morno",
      cold_lead: t.qualificationValues?.coldLead ?? "Lead frio",
    };
    return map[value] ?? value?.replace(/_/g, " ");
  };

  const translateNextAction = (value: string) => {
    const map: Record<string, string> = {
      schedule_callback:
        t.nextActionValues?.scheduleCallback ?? "Agendar retorno",
      send_whatsapp: t.nextActionValues?.sendWhatsapp ?? "Enviar WhatsApp",
      close: t.nextActionValues?.close ?? "Encerrar",
      escalate: t.nextActionValues?.escalate ?? "Escalar",
      continue: t.nextActionValues?.continue ?? "Continuar",
    };
    return map[value] ?? value?.replace(/_/g, " ");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[--radius] border border-border bg-muted p-4"
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
          <Robot weight="fill" className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            {t.title ?? ti("title")}
          </h4>
          <p className="text-xs text-muted-foreground">
            {formatAnalysisDate(analysis.createdAt, locale)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-card p-2 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            {t.interest ?? ti("interest")}
          </p>
          <p className="text-xs font-medium text-foreground">
            {analysis.interest ? translateInterest(analysis.interest) : "-"}
          </p>
        </div>
        <div className="rounded-lg bg-card p-2 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            {t.disposition ?? ti("disposition")}
          </p>
          <p className="text-xs font-medium text-foreground">
            {analysis.disposition
              ? translateDisposition(analysis.disposition)
              : "-"}
          </p>
        </div>
        <div className="rounded-lg bg-card p-2 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            {t.sentiment ?? ti("sentiment")}
          </p>
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2 py-0.5 text-[10px] font-semibold",
              sentimentStyle.bg,
              sentimentStyle.text,
            )}
          >
            {analysis.sentiment ? translateSentiment(analysis.sentiment) : "-"}
          </span>
        </div>
        <div className="rounded-lg bg-card p-2 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            {t.qualification ?? ti("qualification")}
          </p>
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2 py-0.5 text-[10px] font-semibold",
              qualificationStyle.bg,
              qualificationStyle.text,
            )}
          >
            {analysis.qualification
              ? translateQualification(analysis.qualification)
              : "-"}
          </span>
        </div>
        <div className="rounded-lg bg-card p-2 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            {t.nextAction ?? ti("nextAction")}
          </p>
          <p className="text-xs font-medium text-foreground">
            {analysis.nextAction
              ? translateNextAction(analysis.nextAction)
              : "-"}
          </p>
        </div>
        <div className="rounded-lg bg-card p-2 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            {t.quality ?? ti("quality")}
          </p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  analysis.attendanceQuality >= 70
                    ? "bg-healthy"
                    : analysis.attendanceQuality >= 40
                      ? "bg-warning"
                      : "bg-destructive",
                )}
                style={{ width: `${analysis.attendanceQuality}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-foreground">
              {analysis.attendanceQuality}%
            </span>
          </div>
        </div>
      </div>

      {analysis.summary && (
        <div className="rounded-lg bg-card p-2 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t.summary ?? ti("summary")}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {analysis.summary}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function MessageBubble({
  message,
  translations,
}: {
  message: EntryConversationMessage;
  translations?: EntryConversationDialogProps["translations"];
}) {
  const locale = useLocale();
  const tc = useTranslations("entryConversation.channels");
  const [isExpanded, setIsExpanded] = useState(false);

  const isUser =
    message.messageType === "user_message" ||
    (message.messageType === "audio" &&
      message.from !== "system" &&
      !message.from?.startsWith("1555"));

  const isToolCall = message.messageType === "tool_call";
  const isToolResult = message.messageType === "tool_result";
  const isVoice = message.channel === "voice";

  const channelBgClass = isVoice
    ? isUser
      ? "bg-muted border-violet-200"
      : "bg-muted border-violet-100"
    : isUser
      ? "bg-healthy/15 border-healthy/20"
      : "bg-healthy/10 border-healthy/15";

  const getIcon = () => {
    if (isUser) {
      return <User weight="fill" className="h-3.5 w-3.5 text-white" />;
    }
    return <Robot weight="fill" className="h-3.5 w-3.5 text-white" />;
  };

  const getChannelIcon = () => {
    if (isVoice) {
      return <Phone weight="fill" className="h-3 w-3 text-violet-500" />;
    }
    return <WhatsappLogo weight="fill" className="h-3 w-3 text-healthy" />;
  };

  const getToolInfo = () => {
    const callMatch = message.text.match(
      /\[Tool (?:Call|Result)\]\s*(\w+)(?::|$)/,
    );
    if (callMatch) {
      return { name: callMatch[1], hasStructuredContent: true };
    }
    const resultMatch = message.text.match(/\[Tool Result\]\s*(.{0,20})/);
    if (resultMatch && isToolResult) {
      return {
        name:
          resultMatch[1].trim().slice(0, 15) +
          (resultMatch[1].length > 15 ? "..." : ""),
        hasStructuredContent: false,
      };
    }
    return {
      name: isToolCall ? "tool_call" : "result",
      hasStructuredContent: false,
    };
  };

  if (isToolCall || isToolResult) {
    const toolInfo = getToolInfo();

    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center my-1 gap-1"
      >
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2.5 py-1 text-[10px] transition-colors cursor-pointer hover:bg-muted"
        >
          <Wrench weight="fill" className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium text-muted-foreground max-w-[150px] truncate">
            {isToolCall ? "🔧" : "📋"} {toolInfo.name}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {formatMessageTime(message.createdAt, locale)}
          </span>
          {isExpanded ? (
            <CaretDown
              weight="bold"
              className="h-2.5 w-2.5 text-muted-foreground"
            />
          ) : (
            <CaretRight
              weight="bold"
              className="h-2.5 w-2.5 text-muted-foreground"
            />
          )}
        </button>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-[90%] rounded-lg border border-border bg-muted p-2 overflow-x-auto"
          >
            <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {message.text}
            </pre>
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (message.messageType === "system") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-2"
      >
        <div className="inline-flex items-center gap-1.5 rounded-[--radius] bg-muted border border-border px-3 py-1.5">
          <Info weight="fill" className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{message.text}</span>
          <span className="text-[10px] text-muted-foreground ml-1">
            {formatMessageTime(message.createdAt, locale)}
          </span>
        </div>
      </motion.div>
    );
  }

  if (message.messageType === "audio") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}
      >
        <div
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white",
            isUser ? "bg-muted" : "bg-primary",
          )}
        >
          {getIcon()}
        </div>

        <div
          className={cn(
            "max-w-[75%] rounded-[--radius] border px-3 py-2",
            channelBgClass,
            isUser ? "rounded-tr-md" : "rounded-tl-md",
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {getChannelIcon()}
            <span className="text-[10px] font-medium text-muted-foreground">
              {isVoice
                ? (translations?.channels?.voice ?? tc("voice"))
                : (translations?.channels?.whatsapp ?? tc("whatsapp"))}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-white">
              <Waveform weight="fill" className="h-4 w-4" />
            </div>
            <span className="text-sm italic">
              {message.text || "Audio message"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {formatMessageTime(message.createdAt, locale)}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white",
          isUser ? "bg-muted" : "bg-primary",
        )}
      >
        {getIcon()}
      </div>

      <div
        className={cn(
          "max-w-[75%] rounded-[--radius] border px-3 py-2",
          channelBgClass,
          isUser ? "rounded-tr-md" : "rounded-tl-md",
        )}
      >
        <div className="flex items-center gap-1.5 mb-1">
          {getChannelIcon()}
          <span className="text-[10px] font-medium text-muted-foreground">
            {isVoice
              ? (translations?.channels?.voice ?? tc("voice"))
              : (translations?.channels?.whatsapp ?? tc("whatsapp"))}
          </span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
          {message.text}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 text-right">
          {formatMessageTime(message.createdAt, locale)}
        </p>
      </div>
    </motion.div>
  );
}

export default function EntryConversationDialog({
  entryId,
  entryType,
  phoneNumber,
  contactName,
  trigger,
  translations,
}: EntryConversationDialogProps) {
  const t = useTranslations("entryConversation");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState<EntryConversationMessage[]>([]);
  const [analysis, setAnalysis] = useState<EntryConversationAnalysis | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadConversation = useCallback(() => {
    startTransition(async () => {
      setError(null);

      const conversationPromise = getEntryConversationAction(
        entryId,
        entryType,
      );

      const [conversationResult] = await Promise.all([
        conversationPromise,
      ]);

      if (conversationResult.error) {
        setError(conversationResult.error);
        return;
      }

      if (conversationResult.conversation) {
        setMessages(conversationResult.conversation.messages ?? []);
        setAnalysis(conversationResult.conversation.latestAnalysis ?? null);
        setLoaded(true);
      }
    });
  }, [entryId, entryType]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !loaded) {
      loadConversation();
    }
  };

  const defaultTrigger = (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/80"
    >
      <ChatCircle weight="fill" className="h-3.5 w-3.5" />
      <span>{t("viewConversation")}</span>
    </button>
  );

  return (
    <ElevatedDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ElevatedDialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </ElevatedDialogTrigger>
      <ElevatedDialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <ElevatedDialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-[--radius]",
                entryType === "voice" ? "bg-muted" : "bg-healthy",
              )}
            >
              {entryType === "voice" ? (
                <Phone weight="fill" className="h-6 w-6 text-white" />
              ) : (
                <WhatsappLogo weight="fill" className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <ElevatedDialogTitle>
                {translations?.title ?? t("title")}
              </ElevatedDialogTitle>
              <ElevatedDialogDescription className="flex items-center gap-2">
                <span className="font-semibold">{phoneNumber}</span>
                {contactName && (
                  <>
                    <span>•</span>
                    <span>{contactName}</span>
                  </>
                )}
              </ElevatedDialogDescription>
            </div>
          </div>
        </ElevatedDialogHeader>

        <div className="flex-1 min-h-0 -mx-7 px-7 py-4 flex flex-col gap-3">
          {isPending && !loaded ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Spinner className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm">{translations?.loading ?? t("loading")}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <X weight="bold" className="h-8 w-8 mb-3" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
              {/* Transcript */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {messages.length > 0 ? (
                  <div className="space-y-3 pr-2">
                    {messages.map((message, index) => (
                      <MessageBubble
                        key={message.id ?? index}
                        message={message}
                        translations={translations}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ChatCircle weight="light" className="h-12 w-12 mb-3" />
                    <p className="text-sm">
                      {translations?.noMessages ?? t("noMessages")}
                    </p>
                  </div>
                )}
              </div>

              {/* Conversation analysis */}
              {analysis && (
                <div className="w-full lg:w-96 lg:min-h-0 flex-shrink-0 overflow-y-auto overflow-x-hidden">
                  <div className="space-y-4 pr-2">

                    {analysis && (
                      <AnalysisPanel
                        analysis={analysis}
                        translations={translations}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
