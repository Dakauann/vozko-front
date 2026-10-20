"use client";

import { motion } from "framer-motion";

import { Stop, Trash } from "@/components/icons";
import { cn } from "@/lib/utils";

const VISIBLE_BARS = 30;

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

interface VoiceRecordingBarProps {
  duration: number;
  levels: readonly number[];
  onCancel: () => void;
  onStop: () => void;
  labels: { cancel: string; stop: string };
  className?: string;
}

export function VoiceRecordingBar({ duration, levels, onCancel, onStop, labels, className }: VoiceRecordingBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      className={cn("flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4", className)}
    >
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground sm:h-9 sm:w-9"
        aria-label={labels.cancel}
        title={labels.cancel}
      >
        <Trash weight="bold" className="h-4 w-4" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 py-2 sm:gap-3 sm:px-4">
        <span className="relative flex h-2 w-2 flex-shrink-0 sm:h-2.5 sm:w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted opacity-75" />
          <span className="relative inline-flex h-full w-full rounded-full bg-destructive" />
        </span>

        <div className="flex h-6 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden sm:h-7">
          {Array.from({ length: VISIBLE_BARS }).map((_, index) => (
            <motion.div
              key={index}
              className="w-[2px] rounded-full bg-muted sm:w-[3px]"
              initial={{ height: 3 }}
              animate={{ height: Math.max(3, (levels[index] ?? 0) * 20) }}
              transition={{ duration: 0.1, ease: "easeOut" }}
            />
          ))}
        </div>

        <span className="flex-shrink-0 font-mono text-2xs font-semibold tabular-nums text-primary-ink sm:text-xs">
          {formatDuration(duration)}
        </span>
      </div>

      <button
        type="button"
        onClick={onStop}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-md transition-transform hover:scale-105 active:scale-95 sm:h-9 sm:w-9"
        aria-label={labels.stop}
        title={labels.stop}
      >
        <Stop weight="fill" className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
