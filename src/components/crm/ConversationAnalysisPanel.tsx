"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CaretDown,
  ChartBar,
  Fire,
  Smiley,
  SmileyMeh,
  SmileySad,
  Sparkle,
  Target,
  ThumbsDown,
  ThumbsUp,
} from "@/components/icons";
import { useEffect, useRef, useState } from "react";

import type { Analysis } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";
import { getEntryAnalysisAction } from "@/app/actions/analysis";
import { useCrm } from "@/contexts/crm-context";

interface ConversationAnalysisPanelProps {
  entryId: string;
  entryType: "voice" | "whatsapp";
}

/** Solid tile + white glyph (DESIGN.md §5 Icons / Symbols). Never wash + same-hue text. */
const SENTIMENT_CONFIG = {
  positive: {
    label: "Positivo",
    icon: ThumbsUp,
    tile: "bg-healthy",
  },
  neutral: {
    label: "Neutro",
    icon: SmileyMeh,
    tile: "bg-warning",
  },
  negative: {
    label: "Negativo",
    icon: ThumbsDown,
    tile: "bg-destructive",
  },
} as const;

const INTEREST_CONFIG = {
  interested: {
    label: "Interessado",
    tile: "bg-healthy",
  },
  not_interested: {
    label: "Não interessado",
    tile: "bg-destructive",
  },
  undecided: {
    label: "Indeciso",
    tile: "bg-warning",
  },
} as const;

const QUALIFICATION_CONFIG = {
  hot_lead: {
    label: "Hot Lead",
    icon: Fire,
    tile: "bg-destructive",
    bar: "bg-destructive",
  },
  warm_lead: {
    label: "Warm Lead",
    icon: Sparkle,
    tile: "bg-warning",
    bar: "bg-warning",
  },
  cold_lead: {
    label: "Cold Lead",
    icon: Target,
    tile: "bg-primary",
    bar: "bg-primary",
  },
} as const;

const DISPOSITION_LABELS: Record<string, string> = {
  sale: "Venda",
  callback: "Retornar",
  declined: "Recusado",
  no_answer: "Sem resposta",
  voicemail: "Caixa postal",
  pending: "Pendente",
};

const NEXT_ACTION_LABELS: Record<string, string> = {
  schedule_callback: "Agendar retorno",
  send_whatsapp: "Enviar WhatsApp",
  close: "Encerrar",
  escalate: "Escalar",
  continue: "Continuar",
};

export default function ConversationAnalysisPanel({
  entryId,
  entryType,
}: ConversationAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastFetchedRef = useRef<string | null>(null);
  const { latestAnalysisUpdate } = useCrm();

  useEffect(() => {
    const key = `${entryId}:${entryType}`;
    if (lastFetchedRef.current === key) return;
    lastFetchedRef.current = key;

    let cancelled = false;
    setLoading(true);
    setAnalysis(null);
    setExpanded(false);

    getEntryAnalysisAction(entryId, entryType).then((result) => {
      if (cancelled) return;
      setAnalysis(result.analysis);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [entryId, entryType]);

  useEffect(() => {
    if (
      latestAnalysisUpdate &&
      latestAnalysisUpdate.entry_id === entryId &&
      latestAnalysisUpdate.entry_type === entryType
    ) {
      setAnalysis(latestAnalysisUpdate.analysis);
      setLoading(false);
    }
  }, [latestAnalysisUpdate, entryId, entryType]);

  if (loading || !analysis) return null;

  const sentiment = SENTIMENT_CONFIG[analysis.sentiment];
  const interest = INTEREST_CONFIG[analysis.interest];
  const qualification = QUALIFICATION_CONFIG[analysis.qualification];
  const SentimentIcon = sentiment.icon;
  const QualIcon = qualification.icon;

  return (
    <div className="absolute right-3 top-16 z-20 w-72 sm:w-80">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-[--radius] px-3 py-2 text-left shadow-lg border transition-all",
          expanded
            ? "bg-card border-border rounded-b-none shadow-md"
            : "bg-card border-border hover:bg-card hover:shadow-xl",
        )}
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white">
          <ChartBar weight="fill" className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold text-foreground flex-1">
          Análise
        </span>

        {/* Mini symbols when collapsed: solid tile + white glyph */}
        {!expanded && (
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md text-white",
                sentiment.tile,
              )}
              title={sentiment.label}
            >
              <SentimentIcon weight="fill" className="h-3 w-3" />
            </span>
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md text-white",
                qualification.tile,
              )}
              title={qualification.label}
            >
              <QualIcon weight="fill" className="h-3 w-3" />
            </span>
          </div>
        )}

        <CaretDown
          weight="bold"
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden rounded-b-xl border border-t-0 border-border bg-card shadow-lg"
          >
            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-3">
              {/* Attendance Quality Progress Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Qualidade do atendimento
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {analysis.attendanceQuality}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.attendanceQuality}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                    className={cn(
                      "h-full rounded-full",
                      analysis.attendanceQuality >= 70
                        ? "bg-healthy/100"
                        : analysis.attendanceQuality >= 40
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                  />
                </div>
              </div>

              {/* Meaning chips: solid fill + white text (no same-hue wash) */}
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-[10px] font-semibold text-white",
                    sentiment.tile,
                  )}
                >
                  <SentimentIcon weight="fill" className="h-3 w-3" />
                  {sentiment.label}
                </span>

                <span
                  className={cn(
                    "inline-flex items-center rounded-[--radius] px-2 py-0.5 text-[10px] font-semibold text-white",
                    interest.tile,
                  )}
                >
                  {interest.label}
                </span>

                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-[10px] font-semibold text-white",
                    qualification.tile,
                  )}
                >
                  <QualIcon weight="fill" className="h-3 w-3" />
                  {qualification.label}
                </span>

                <span className="inline-flex items-center rounded-[--radius] bg-muted px-2 py-0.5 text-[10px] font-semibold text-white">
                  {DISPOSITION_LABELS[analysis.disposition] ??
                    analysis.disposition}
                </span>

                <span className="inline-flex items-center rounded-[--radius] bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                  {NEXT_ACTION_LABELS[analysis.nextAction] ??
                    analysis.nextAction}
                </span>
              </div>

              {/* Summary */}
              {analysis.summary && (
                <div className="rounded-lg bg-muted p-2.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Resumo
                  </p>
                  <p className="text-[11px] leading-relaxed text-foreground">
                    {analysis.summary}
                  </p>
                </div>
              )}

              {/* Footer meta */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-[9px] text-muted-foreground">
                  {analysis.messageCount} mensagens analisadas
                </span>
                {analysis.productInterest && (
                  <span className="text-[9px] font-medium text-muted-foreground truncate max-w-[50%]">
                    Produto: {analysis.productInterest}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
