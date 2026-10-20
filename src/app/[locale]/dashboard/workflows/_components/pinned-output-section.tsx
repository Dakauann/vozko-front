"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PushPin, Trash } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import {
  MANUAL_PIN_SOURCE,
  isWithheldPin,
  parsePinDraft,
  pinSourceOf,
  pinText,
  type NodePin,
  type PinDraftError,
} from "@/lib/workflows/node-pin";

import { DateTimeText, FieldLine, JsonBlock } from "./run-bits";

const DEFAULT_EDGE = "__default__";

const ERROR_KEYS: Record<PinDraftError, string> = {
  invalid_json: "invalidJson",
  not_object: "notObject",
  too_large: "tooLarge",
  unknown_edge: "unknownEdge",
};

interface PinDraft {
  text: string;
  edge: string;
  error: PinDraftError | null;
}

export function PinnedOutputSection({
  nodeId,
  pin,
  edgeLabels,
  unsaved,
  onChange,
}: {
  nodeId: string;
  pin: NodePin | undefined;
  edgeLabels: readonly string[];
  unsaved: boolean;
  onChange: (nodeId: string, pin: NodePin | null) => void;
}) {
  const t = useTranslations("workflowDebug.pin");
  const [draft, setDraft] = useState<PinDraft | null>(null);
  const source = pin ? pinSourceOf(pin.source) : null;
  const withheld = isWithheldPin(pin);

  const startEditing = () => setDraft({ text: pin ? pinText(pin) : "{}", edge: pin?.edge ?? "", error: null });

  const apply = () => {
    if (!draft) return;
    const parsed = parsePinDraft({ text: draft.text, edge: draft.edge, edges: edgeLabels, source: MANUAL_PIN_SOURCE, at: new Date() });
    if ("error" in parsed) {
      setDraft({ ...draft, error: parsed.error });
      return;
    }
    onChange(nodeId, parsed.pin);
    setDraft(null);
  };

  const sourceLabel = !source
    ? t("sources.unknown")
    : source.kind === "run"
      ? t("sources.run", { run: (source.runId ?? "").slice(0, 8) })
      : t(`sources.${source.kind}`);

  return (
    <section aria-label={t("title")} className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <PushPin size={14} weight={pin ? "fill" : "regular"} className="text-primary-ink" />
        <span className="text-xs font-medium text-foreground">{t("title")}</span>
      </div>
      <p className="text-2xs leading-relaxed text-muted-foreground">{t("notPublished")}</p>

      {pin && withheld && (
        <div className="space-y-2">
          <FieldLine label={t("edge")}>{pin.edge || t("defaultEdge")}</FieldLine>
          <FieldLine label={t("pinnedAt")}>
            <DateTimeText value={pin.pinned_at} />
          </FieldLine>
          <p className="text-2xs text-muted-foreground">{sourceLabel}</p>
          <p className="text-xs font-medium text-foreground">{t("withheld")}</p>
          <p className="text-2xs leading-relaxed text-muted-foreground">{t("withheldHint")}</p>
        </div>
      )}

      {pin && !withheld && !draft && (
        <div className="space-y-2">
          <FieldLine label={t("edge")}>{pin.edge || t("defaultEdge")}</FieldLine>
          <FieldLine label={t("pinnedAt")}>
            <DateTimeText value={pin.pinned_at} />
          </FieldLine>
          <p className="text-2xs text-muted-foreground">{sourceLabel}</p>
          <JsonBlock value={pin.output} className="max-h-40" />
          {unsaved && <p className="text-2xs text-muted-foreground">{t("unsavedHint")}</p>}
          <div className="flex flex-wrap gap-1.5">
            <ElevatedButton variant="outline-subtle" size="sm" title={t("edit")} onClick={startEditing} />
            <ElevatedButton
              variant="ghost"
              size="sm"
              iconVisible
              icon={<Trash size={12} />}
              title={t("clear")}
              onClick={() => onChange(nodeId, null)}
              className="text-destructive-ink"
            />
          </div>
        </div>
      )}

      {!pin && !draft && <ElevatedButton variant="outline-subtle" size="sm" title={t("add")} onClick={startEditing} />}

      {draft && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-2xs text-muted-foreground">{t("output")}</span>
            <textarea
              value={draft.text}
              onChange={(event) => setDraft({ ...draft, text: event.target.value, error: null })}
              spellCheck={false}
              rows={8}
              aria-invalid={draft.error !== null && draft.error !== "unknown_edge"}
              className="w-full resize-y rounded-[--radius] border border-control-edge bg-background p-2 font-mono text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <ElevatedSelect
            label={t("edge")}
            value={draft.edge || DEFAULT_EDGE}
            onValueChange={(value) => setDraft({ ...draft, edge: value === DEFAULT_EDGE ? "" : value, error: null })}
          >
            <ElevatedSelectItem value={DEFAULT_EDGE}>{t("defaultEdge")}</ElevatedSelectItem>
            {edgeLabels.map((label) => (
              <ElevatedSelectItem key={label} value={label}>
                {label}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          {draft.error && (
            <p role="alert" className="text-2xs text-destructive-ink">
              {t(`errors.${ERROR_KEYS[draft.error]}`)}
            </p>
          )}
          <div className="flex gap-1.5">
            <ElevatedButton variant="primary" size="sm" title={t("apply")} onClick={apply} />
            <ElevatedButton variant="ghost" size="sm" title={t("cancel")} onClick={() => setDraft(null)} />
          </div>
        </div>
      )}
    </section>
  );
}
