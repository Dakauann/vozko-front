"use client";


import {
  ArrowsClockwise,
  CheckCircle,
  Sparkle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type {
  TextRefinerDiffSegment,
  TextRefinerKind,
  TextRefinerModel,
} from "@/lib/text-refiner/types";
import {
  listTextRefinerModelsAction,
  refineTextAction,
} from "@/app/actions/text-refiner";
import { useEffect, useMemo, useState, useTransition } from "react";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface PromptRefinerPanelProps {
  title: string;
  value: string;
  onApply: (refinedText: string) => void;
  helper?: string;
  kind?: TextRefinerKind;
  className?: string;
}

export function PromptRefinerPanel({
  title,
  value,
  onApply,
  helper,
  kind = "generic",
  className,
}: PromptRefinerPanelProps) {
  const t = useTranslations("agents.refiner");
  const { toast } = useToast();
  const [isRefining, startRefining] = useTransition();

  const [instruction, setInstruction] = useState("");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<TextRefinerModel[]>([]);
  const [segments, setSegments] = useState<TextRefinerDiffSegment[] | null>(
    null,
  );
  const [refinedText, setRefinedText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listTextRefinerModelsAction();
      if (cancelled) return;
      setModels(res.models);
      // keep "" so backend uses its default model unless user picks one.
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSegments(null);
    setRefinedText(null);
  }, [value]);

  const canRefine = value.trim().length > 0 && instruction.trim().length > 0;

  const handleRefine = () => {
    if (!canRefine) return;
    startRefining(async () => {
      const res = await refineTextAction({
        text: value,
        instruction: instruction.trim(),
        kind,
        model: model || undefined,
      });

      if (res.errorCode === "INSUFFICIENT_BALANCE") {
        toast({
          title: t("errors.insufficientBalance.title"),
          description: t("errors.insufficientBalance.description"),
          variant: "destructive",
        });
        return;
      }
      if (res.error || !res.result) {
        toast({
          title: t("errors.failed.title"),
          description: res.error ?? t("errors.failed.description"),
          variant: "destructive",
        });
        return;
      }

      setSegments(res.result.segments);
      setRefinedText(res.result.refinedText);
    });
  };

  const handleApply = () => {
    if (refinedText === null) return;
    onApply(refinedText);
    toast({
      title: t("applied.title"),
      description: t("applied.description"),
    });
    setSegments(null);
    setRefinedText(null);
    setInstruction("");
  };

  const handleDiscard = () => {
    setSegments(null);
    setRefinedText(null);
  };

  const stats = useMemo(() => {
    if (!segments) return null;
    let added = 0;
    let removed = 0;
    for (const seg of segments) {
      if (seg.op === "insert") added += seg.text.length;
      else if (seg.op === "delete") removed += seg.text.length;
    }
    return { added, removed };
  }, [segments]);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-3xl border border-border bg-card/70 p-5 shadow-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg">
          <Sparkle className="h-5 w-5" weight="fill" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {helper ? (
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
          ) : null}
        </div>
      </div>

      {/* Instruction input */}
      <div className="mt-4 space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("instructionLabel")}
        </label>
        <ElevatedTextarea
          rows={3}
          placeholder={t("instructionPlaceholder")}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isRefining}
        />
      </div>

      {/* Examples, quick-click chips with kind-aware suggestions */}
      <ExampleChips
        kind={kind}
        disabled={isRefining}
        onPick={(text) => setInstruction(text)}
      />

      {/* Model picker */}
      {models.length > 0 ? (
        <div className="mt-3">
          <AIModelSelector
            label={t("modelLabel")}
            value={model}
            onValueChange={(v) => setModel(v)}
            models={models.map((m) => m.id)}
            modelPricing={models}
            disabled={isRefining}
            searchPlaceholder={t("modelPlaceholder")}
          />
        </div>
      ) : null}

      {/* Action button */}
      <button
        type="button"
        onClick={handleRefine}
        disabled={!canRefine || isRefining}
        className={cn(
          "mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all",
          "hover:brightness-110 active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {isRefining ? (
          <ArrowsClockwise className="h-4 w-4 animate-spin" weight="bold" />
        ) : (
          <Sparkle className="h-4 w-4" weight="fill" />
        )}
        {isRefining ? t("refining") : t("refine")}
      </button>

      {/* Diff result */}
      {segments && refinedText !== null ? (
        <div className="mt-5 flex flex-1 flex-col">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              {t("diffTitle")}
            </p>
            {stats ? (
              <p className="text-[11px] font-medium text-muted-foreground">
                <span className="text-emerald-600">+{stats.added}</span>
                {" / "}
                <span className="text-rose-600">−{stats.removed}</span>{" "}
                {t("characters")}
              </p>
            ) : null}
          </div>

          <div className="mt-2 flex-1 overflow-auto rounded-xl border border-border bg-background/60 p-3 text-sm leading-relaxed">
            {segments.map((seg, i) => {
              if (seg.op === "equal") {
                return (
                  <span
                    key={i}
                    className="text-foreground/80 whitespace-pre-wrap"
                  >
                    {seg.text}
                  </span>
                );
              }
              if (seg.op === "insert") {
                return (
                  <span
                    key={i}
                    className="rounded bg-emerald-500/15 px-0.5 text-emerald-700 whitespace-pre-wrap"
                  >
                    {seg.text}
                  </span>
                );
              }
              return (
                <span
                  key={i}
                  className="rounded bg-rose-500/15 px-0.5 text-rose-700 line-through whitespace-pre-wrap"
                >
                  {seg.text}
                </span>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <CheckCircle className="h-4 w-4" weight="fill" />
              {t("apply")}
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <XCircle className="h-4 w-4" weight="bold" />
              {t("discard")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <div>
            <WarningCircle
              className="mx-auto h-8 w-8 text-muted-foreground/60"
              weight="duotone"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("emptyHint")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ExampleChips({
  kind,
  onPick,
  disabled,
}: {
  kind: TextRefinerKind;
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("agents.refiner");
  const examples = useMemo<string[]>(() => {
    try {
      const raw = (t as unknown as { raw: (key: string) => unknown }).raw(
        `examples.${kind}`,
      );
      return Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === "string")
        : [];
    } catch {
      return [];
    }
  }, [t, kind]);

  if (examples.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("examplesLabel")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={disabled}
            onClick={() => onPick(ex)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-all",
              "hover:bg-amber-500/20 hover:text-amber-800",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Sparkle className="h-3 w-3" weight="fill" />
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
