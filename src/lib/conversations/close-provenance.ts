
export type CloseSourceCode = "human" | "ai" | "system" | string;
export type CloseReasonCode =
  | "manual"
  | "ai_resolved"
  | "customer_idle"
  | "max_age"
  | "workflow"
  | string;

export type CloseProvenance = {
  short: string;
  by: string;
  reasonLabel: string;
  isSilence: boolean;
  source: CloseSourceCode;
  reason: CloseReasonCode;
};

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
    return {
      short: "inatividade",
      by: "Sistema",
      reasonLabel: "Inatividade (idade máxima)",
      isSilence: false,
      source: source || "system",
      reason: "max_age",
    };
  }
  if (reason === "workflow") {
    return {
      short: "fluxo",
      by: "Workflow",
      reasonLabel: "Finalizada pelo fluxo",
      isSilence: false,
      source: source || "system",
      reason: "workflow",
    };
  }
  if (source === "system" || reason === "customer_idle") {
    return {
      short: "silêncio",
      by: "Sistema",
      reasonLabel: "Silêncio do cliente",
      isSilence: true,
      source: source || "system",
      reason: reason || "customer_idle",
    };
  }
  if (source === "ai" || reason === "ai_resolved") {
    return {
      short: "IA",
      by: "IA",
      reasonLabel: "Resolvida pela IA",
      isSilence: false,
      source: source || "ai",
      reason: reason || "ai_resolved",
    };
  }
  if (source === "human" || reason === "manual") {
    return {
      short: "atendente",
      by: "Atendente",
      reasonLabel: "Manual",
      isSilence: false,
      source: source || "human",
      reason: reason || "manual",
    };
  }
  if (source || reason) {
    return {
      short: source || reason,
      by: source || "—",
      reasonLabel: reason || "—",
      isSilence: false,
      source: source || "",
      reason: reason || "",
    };
  }
  return null;
}

export type ConversationStatusDisplay = {
  baseLabel: string;
  label: string;
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
        baseLabel: "Em andamento",
        label: "Em andamento",
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
        baseLabel: "Finalizada",
        label: provenance
          ? `Finalizada · ${provenance.short}`
          : "Finalizada",
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
        baseLabel: "Nova",
        label: "Nova",
        dotClassName: "bg-primary",
        menuAccentClassName: "text-primary-ink",
        provenance: null,
      };
  }
}
