export type CloseSourceCode = "human" | "ai" | "system" | string;
export type CloseReasonCode =
  | "manual"
  | "ai_resolved"
  | "customer_idle"
  | "max_age"
  | "workflow"
  | string;

type KnownProvenanceKind = "max_age" | "workflow" | "silence" | "ai" | "human";

export type CloseProvenanceKind = KnownProvenanceKind | "other";

export type CloseProvenance = {
  kind: CloseProvenanceKind;
  isSilence: boolean;
  source: CloseSourceCode;
  reason: CloseReasonCode;
};

export type ConversationStatusKey = "new" | "ongoing" | "finished";

export type StatusTranslator = (key: string, values?: Record<string, string>) => string;

export function resolveCloseProvenance(
  closeSource?: string | null,
  closeReason?: string | null,
): CloseProvenance | null {
  const source = String(closeSource ?? "")
    .trim()
    .toLowerCase();
  const reason = String(closeReason ?? "")
    .trim()
    .toLowerCase();

  if (!source && !reason) return null;

  if (reason === "max_age") {
    return { kind: "max_age", isSilence: false, source: source || "system", reason: "max_age" };
  }
  if (reason === "workflow") {
    return { kind: "workflow", isSilence: false, source: source || "system", reason: "workflow" };
  }
  if (source === "system" || reason === "customer_idle") {
    return { kind: "silence", isSilence: true, source: source || "system", reason: reason || "customer_idle" };
  }
  if (source === "ai" || reason === "ai_resolved") {
    return { kind: "ai", isSilence: false, source: source || "ai", reason: reason || "ai_resolved" };
  }
  if (source === "human" || reason === "manual") {
    return { kind: "human", isSilence: false, source: source || "human", reason: reason || "manual" };
  }
  return { kind: "other", isSilence: false, source, reason };
}

export interface CloseProvenanceText {
  short: string;
  by: string;
  reason: string;
}

export function closeProvenanceText(provenance: CloseProvenance, t: StatusTranslator): CloseProvenanceText {
  if (provenance.kind === "other") {
    return { short: provenance.source || provenance.reason, by: provenance.source, reason: provenance.reason };
  }
  return {
    short: t(`provenance.${provenance.kind}.short`),
    by: t(`provenance.${provenance.kind}.by`),
    reason: t(`provenance.${provenance.kind}.reason`),
  };
}

type ConversationStatusDisplay = {
  statusKey: ConversationStatusKey;
  dotClassName: string;
  menuAccentClassName: string;
  provenance: CloseProvenance | null;
};

export function getConversationStatusDisplay(
  status?: string | null,
  closeSource?: string | null,
  closeReason?: string | null,
): ConversationStatusDisplay {
  const provenance =
    status === "finished"
      ? resolveCloseProvenance(closeSource, closeReason)
      : null;

  switch (status) {
    case "ongoing":
      return {
        statusKey: "ongoing",
        dotClassName: "bg-amber-500",
        menuAccentClassName: "text-amber-700 dark:text-amber-400",
        provenance: null,
      };
    case "finished": {
      const isSilence = provenance?.isSilence === true;
      const isMaxAge = provenance?.reason === "max_age";
      const isWorkflow = provenance?.reason === "workflow";
      const isAi = provenance?.source === "ai";
      return {
        statusKey: "finished",
        dotClassName: isSilence || isMaxAge
          ? "bg-amber-500"
          : isWorkflow
            ? "bg-slate-600"
            : isAi
              ? "bg-violet-500"
              : "bg-healthy",
        menuAccentClassName: isSilence || isMaxAge
          ? "text-amber-700 dark:text-amber-400"
          : isWorkflow
            ? "text-slate-700 dark:text-slate-300"
            : isAi
              ? "text-violet-700 dark:text-violet-400"
              : "text-healthy-ink",
        provenance,
      };
    }
    default:
      return {
        statusKey: "new",
        dotClassName: "bg-primary",
        menuAccentClassName: "text-primary-ink",
        provenance: null,
      };
  }
}

export interface ConversationStatusText {
  baseLabel: string;
  label: string;
}

export function conversationStatusText(display: ConversationStatusDisplay, t: StatusTranslator): ConversationStatusText {
  const baseLabel = t(display.statusKey);
  if (!display.provenance) return { baseLabel, label: baseLabel };
  const { short } = closeProvenanceText(display.provenance, t);
  return { baseLabel, label: short ? t("finishedWith", { short }) : baseLabel };
}
