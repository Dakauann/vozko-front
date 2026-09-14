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

/**
 * The message composer — this channel's replacement for the template picker.
 *
 * There is no template on a linked-device session, so the operator authors the
 * message here. Two parts of this are load-bearing rather than cosmetic:
 *
 *  - **Variants.** Identical bodies leaving one number at volume are what
 *    WhatsApp's spam heuristics weight, and there is no template to hide behind.
 *    One variant is picked per recipient, so a 5.000-number run sends five texts
 *    rather than one text five thousand times. The UI says why.
 *  - **Same placeholders across variants.** Not merely the same count: a variant
 *    reading {{1}} beside one reading {{2}} would send a raw "{{2}}" to everyone
 *    assigned the second, because the importer collected one set of columns.
 */

const KINDS: UnofficialWhatsAppMessageKind[] = [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "menu",
];

/** Kinds that cannot be delivered without an attachment. */
const NEEDS_MEDIA: UnofficialWhatsAppMessageKind[] = [
  "image",
  "video",
  "audio",
  "document",
];

const MAX_VARIANTS = 10;

/**
 * The placeholder rules live in MessageVariantsEditor now, because a lead
 * import authors its first message the same way and a second copy of them would
 * be a second chance to disagree with the Go domain.
 *
 * Re-exported so the campaign form's imports do not move, and so the one thing
 * that IS about a campaign spec — reading the bodies off it — stays here.
 */
export { placeholdersIn, variantsAgree };

/** The highest placeholder across every variant — how many columns an import needs. */
export function parameterCount(spec: UnofficialWhatsAppMessageSpec): number {
  return parameterCountIn(spec.bodies);
}

export interface CampaignMessageComposerProps {
  value: UnofficialWhatsAppMessageSpec;
  onChange: (next: UnofficialWhatsAppMessageSpec) => void;
  /** Rendered in the media slot; the media picker belongs to the host form. */
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

/**
 * The menu editor.
 *
 * The option caps come from WhatsApp itself, not from us: three buttons is a
 * different message type from a ten-row list, which is why the style selector
 * changes the limit rather than the layout.
 */
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
        {/* The cap is WhatsApp's, and saying whose it is stops it reading as an
            arbitrary product limit somebody could ask us to raise. */}
        <p className="text-2xs text-muted-foreground">{t("form.optionCapHelp", { max })}</p>
      </div>
    </div>
  );
}
