"use client";

import { Smiley, SmileyMeh, SmileySad } from "@/components/icons";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Stats-panel primitives shared by every analysis dashboard: the
// conversation AnalysisStatsPanel and the Instagram comment-analysis
// overview both render sentiment and breakdowns through these, so the two
// cannot drift apart visually. No chart styling lives here; charts come
// from components/charts/vozko.tsx.

export type SentimentType = "positive" | "neutral" | "negative";

export function ProgressBar({
  label,
  value,
  total,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  delay?: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {value}{" "}
          <span className="text-muted-foreground">
            ({percentage.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1 }}
        />
      </div>
    </motion.div>
  );
}

export function SentimentBadge({
  type,
  value,
  total,
  delay = 0,
}: {
  type: SentimentType;
  value: number;
  total: number;
  delay?: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  const config = {
    positive: {
      icon: <Smiley weight="fill" className="h-5 w-5" />,
      color: "hsl(var(--healthy))",
      bgColor: "bg-muted",
      borderColor: "border-healthy/20",
    },
    neutral: {
      icon: <SmileyMeh weight="fill" className="h-5 w-5" />,
      color: "hsl(var(--muted-foreground))",
      bgColor: "bg-muted",
      borderColor: "border-border",
    },
    negative: {
      icon: <SmileySad weight="fill" className="h-5 w-5" />,
      color: "hsl(var(--destructive))",
      bgColor: "bg-muted",
      borderColor: "border-destructive/30",
    },
  };

  const { icon, color, bgColor, borderColor } = config[type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-[--radius] border",
        bgColor,
        borderColor,
      )}
    >
      <span style={{ color }}>{icon}</span>
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">
          {percentage.toFixed(1)}%
        </p>
      </div>
    </motion.div>
  );
}
