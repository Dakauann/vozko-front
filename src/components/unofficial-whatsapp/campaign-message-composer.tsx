"use client";

import { Plus, Trash } from "@/components/icons";
import type {
  UnofficialWhatsAppMessageKind,
  UnofficialWhatsAppMessageSpec,
} from "@/lib/unofficial-whatsapp-campaigns/types";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  MessageVariantsEditor,
  parameterCountIn,
  placeholdersIn,
  variantsAgree,
} from "@/components/unofficial-whatsapp/message-variants-editor";
import { useTranslations } from "next-intl";


const KINDS: UnofficialWhatsAppMessageKind[] = [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "menu",
];

const NEEDS_MEDIA: UnofficialWhatsAppMessageKind[] = [
  "image",
  "video",
  "audio",
  "document",
];

const MAX_VARIANTS = 10;

export { placeholdersIn, variantsAgree };

export function parameterCount(spec: UnofficialWhatsAppMessageSpec): number {
  return parameterCountIn(spec.bodies);
}

export interface CampaignMessageComposerProps {
  value: UnofficialWhatsAppMessageSpec;
  onChange: (next: UnofficialWhatsAppMessageSpec) => void;
  mediaSlot?: React.ReactNode;
  disabled?: boolean;
}

export function CampaignMessageComposer({
  value,
  onChange,
  mediaSlot,
  disabled,
}: CampaignMessageComposerProps) {
  const t = useTranslations("unofficialWhatsappCampaigns");

  const setKind = (kind: UnofficialWhatsAppMessageKind) =>
    onChange({ ...value, kind });

  const needsMedia = NEEDS_MEDIA.includes(value.kind);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("form.messageKind")}
          </label>
          <ElevatedSelect
            value={value.kind}
            onValueChange={(v) => setKind(v as UnofficialWhatsAppMessageKind)}
            disabled={disabled}
          >
            {KINDS.map((kind) => (
              <ElevatedSelectItem key={kind} value={kind}>
                {t(`messageKind.${kind}`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>

        {needsMedia ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t("form.attachment")}
            </label>
            {mediaSlot}
          </div>
        ) : null}
      </div>

      <MessageVariantsEditor
        bodies={value.bodies}
        onChange={(bodies) => onChange({ ...value, bodies })}
        max={MAX_VARIANTS}
        disabled={disabled}
        labels={{
          title: t("form.variantsTitle"),
          help: t("form.variantsHelp"),
          addVariant: t("form.addVariant"),
          removeVariant: t("form.removeVariant"),
          variantLabel: (index) => t("form.variantLabel", { index }),
          bodyPlaceholder: t("form.bodyPlaceholder"),
          mismatch: t("form.variantsMismatch"),
          variablesDetected: (count) => t("form.variablesDetected", { count }),
        }}
      />

      {value.kind === "menu" ? (
        <MenuEditor value={value} onChange={onChange} disabled={disabled} />
      ) : null}
    </div>
  );
}

function MenuEditor({
  value,
  onChange,
  disabled,
}: {
  value: UnofficialWhatsAppMessageSpec;
  onChange: (next: UnofficialWhatsAppMessageSpec) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const options = value.options ?? [];
  const max = value.style === "list" ? 10 : 3;

  const update = (index: number, patch: Partial<(typeof options)[number]>) => {
    const next = options.map((o, i) => (i === index ? { ...o, ...patch } : o));
    onChange({ ...value, options: next });
  };

  return (
    <div className="space-y-3 rounded-[--radius] border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("form.menuStyle")}
          </label>
          <ElevatedSelect
            value={value.style ?? "buttons"}
            onValueChange={(v) =>
              onChange({ ...value, style: v as "buttons" | "list" })
            }
            disabled={disabled}
          >
            <ElevatedSelectItem value="buttons">
              {t("form.menuStyleButtons")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="list">
              {t("form.menuStyleList")}
            </ElevatedSelectItem>
          </ElevatedSelect>
        </div>
        <ElevatedInput
          label={t("form.menuFooter")}
          value={value.footer ?? ""}
          onChange={(e) => onChange({ ...value, footer: e.target.value })}
          disabled={disabled}
          controlSize="sm"
        />
      </div>

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <ElevatedInput
              label={t("form.optionId")}
              value={option.id}
              onChange={(e) => update(index, { id: e.target.value })}
              disabled={disabled}
              controlSize="sm"
            />
            <ElevatedInput
              label={t("form.optionTitle")}
              value={option.title}
              onChange={(e) => update(index, { title: e.target.value })}
              disabled={disabled}
              controlSize="sm"
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  options: options.filter((_, i) => i !== index),
                })
              }
              disabled={disabled}
              className="self-end rounded-lg px-2 py-2 text-destructive-ink transition-colors hover:bg-muted"
              aria-label={t("form.removeOption")}
            >
              <Trash className="h-4 w-4" weight="bold" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            onChange({ ...value, options: [...options, { id: "", title: "" }] })
          }
          disabled={disabled || options.length >= max}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" weight="bold" />
          {t("form.addOption", { max })}
        </button>
        {
}
        <p className="text-2xs text-muted-foreground">{t("form.optionCapHelp", { max })}</p>
      </div>
    </div>
  );
}
