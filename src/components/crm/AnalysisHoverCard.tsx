"use client";

import { AnimatePresence, easeIn, easeOut, motion } from "framer-motion";
import {
  ChartBar,
  Fire,
  SmileyMeh,
  Sparkle,
  Target,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";

import type { Analysis } from "@/lib/analysis/types";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Solid tile + white glyph, never colored glyph on same-hue wash. */
const SENTIMENT_MAP = {
  positive: { label: "Positivo", icon: ThumbsUp, tile: "bg-emerald-500" },
  neutral: { label: "Neutro", icon: SmileyMeh, tile: "bg-amber-500" },
  negative: { label: "Negativo", icon: ThumbsDown, tile: "bg-rose-500" },
} as const;

const INTEREST_MAP = {
  interested: { label: "Interessado", tile: "bg-emerald-500" },
  not_interested: { label: "Sem interesse", tile: "bg-rose-500" },
  undecided: { label: "Indeciso", tile: "bg-amber-500" },
} as const;

const QUALIFICATION_MAP = {
  hot_lead: { label: "Quente", icon: Fire, tile: "bg-rose-500" },
  warm_lead: { label: "Morno", icon: Sparkle, tile: "bg-amber-500" },
  cold_lead: { label: "Frio", icon: Target, tile: "bg-primary" },
} as const;

const DISPOSITION_MAP: Record<string, string> = {
  sale: "Venda",
  filling_info: "Coletando dados",
  callback: "Retornar",
  declined: "Recusado",
  no_answer: "Sem resposta",
  voicemail: "Caixa postal",
  pending: "Pendente",
};

const NEXT_ACTION_MAP: Record<string, string> = {
  schedule_callback: "Agendar retorno",
  send_whatsapp: "Enviar WhatsApp",
  close: "Encerrar",
  escalate: "Escalar",
  continue: "Continuar",
};

function qualityColor(q: number): string {
  if (q >= 85) return "bg-emerald-500";
  if (q >= 70) return "bg-emerald-500";
  if (q >= 55) return "bg-amber-500";
  if (q >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

interface AnalysisHoverCardProps {
  analysis: Analysis;
  visible: boolean;
  position?: "below" | "above" | "right";
  preset?: "default" | "inbox";
  anchorRect?: { top: number; right: number; height: number } | null;
}

export default function AnalysisHoverCard({
  analysis,
  visible,
  position = "below",
  preset = "default",
  anchorRect,
}: AnalysisHoverCardProps) {
  const sentiment = SENTIMENT_MAP[analysis.sentiment];
  const interest = INTEREST_MAP[analysis.interest];
  const qualification = QUALIFICATION_MAP[analysis.qualification];
  const SentimentIcon = sentiment.icon;
  const QualIcon = qualification.icon;

  const isRightFlyout = position === "right";

  const initialAnimation = isRightFlyout
    ? { opacity: 0, scaleX: 0.02 }
    : preset === "inbox"
      ? { opacity: 0, height: 0 }
      : { opacity: 0, y: position === "below" ? -4 : 4, scaleY: 0.95 };

  const animateAnimation = isRightFlyout
    ? { opacity: 1, scaleX: 1 }
    : preset === "inbox"
      ? { opacity: 1, height: "auto" }
      : { opacity: 1, y: 0, scaleY: 1 };

  const exitAnimation = isRightFlyout
    ? { opacity: 0, scaleX: 0.02 }
    : preset === "inbox"
      ? { opacity: 0, height: 0 }
      : { opacity: 0, y: position === "below" ? -4 : 4, scaleY: 0.95 };

  const transitionAnimation = isRightFlyout
    ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }
    : preset === "inbox"
      ? { duration: 0.18, ease: easeIn }
      : { duration: 0.15, ease: easeOut };

  const usePortal = isRightFlyout && !!anchorRect;

  const cardClassName = isRightFlyout
    ? "w-[290px] overflow-hidden rounded-r-xl border border-l-0 border-border/90 bg-card/95 px-3 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-sm"
    : "pointer-events-none w-full overflow-hidden border-t border-border bg-card px-3 py-2.5";

  const transformOrigin = isRightFlyout
    ? "left center"
    : position === "below"
      ? "top"
      : "bottom";

  const portalStyle = usePortal
    ? {
        position: "fixed" as const,
        top: anchorRect!.top,
        left: anchorRect!.right,
        transformOrigin: "left center",
        zIndex: 9999,
        pointerEvents: "none" as const,
      }
    : { transformOrigin };

  const card = (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={initialAnimation}
          animate={animateAnimation}
          exit={exitAnimation}
          transition={transitionAnimation}
          style={portalStyle}
          className={cardClassName}
        >
          <div className="mb-1.5 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-primary text-white">
                <ChartBar weight="fill" className="h-3 w-3" />
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    qualityColor(analysis.attendanceQuality),
                  )}
                  style={{ width: `${analysis.attendanceQuality}%` }}
                />
              </div>
              <span className="w-6 text-right text-[9px] font-bold tabular-nums text-muted-foreground">
                {analysis.attendanceQuality}
              </span>
            </div>

            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-white",
                sentiment.tile,
              )}
              title={sentiment.label}
            >
              <SentimentIcon weight="fill" className="h-3 w-3" />
            </span>

            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-white",
                qualification.tile,
              )}
              title={qualification.label}
            >
              <QualIcon weight="fill" className="h-3 w-3" />
            </span>
          </div>

          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white",
                interest.tile,
              )}
            >
              {interest.label}
            </span>

            <span className="inline-flex items-center rounded-full bg-slate-600 px-1.5 py-0.5 text-[8px] font-bold text-white">
              {DISPOSITION_MAP[analysis.disposition] || analysis.disposition}
            </span>

            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold text-white">
              <Sparkle weight="fill" className="h-2 w-2" />
              {NEXT_ACTION_MAP[analysis.nextAction] || analysis.nextAction}
            </span>
          </div>

          {analysis.summary && (
            <p className="line-clamp-2 text-[9px] leading-relaxed text-muted-foreground">
              {analysis.summary}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (usePortal && typeof window !== "undefined") {
    return createPortal(card, document.body);
  }
  return card;
}
