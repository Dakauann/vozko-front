"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import Button from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ArrowDown, ArrowUp, Envelope, Plus, TextAlignLeft, Trash } from "@/components/icons";
import { columnCount } from "@/lib/email-design/document";
import {
  DEFAULT_DIVIDER_COLOR,
  DEFAULT_SETTINGS,
  FONT_FAMILIES,
  MAX_ADDRESS_RUNES,
  MAX_ALT_RUNES,
  MAX_BUTTON_LABEL_RUNES,
  MAX_COMPANY_RUNES,
  MAX_DIVIDER_THICKNESS,
  MAX_FOOTER_TEXT_RUNES,
  MAX_HEADING_RUNES,
  MAX_HREF_RUNES,
  MAX_IMAGE_WIDTH,
  MAX_PREHEADER_RUNES,
  MAX_SOCIAL_LABEL_RUNES,
  MAX_SPACER_HEIGHT,
  MAX_TEXT_BLOCK_RUNES,
  MAX_WIDTH,
  MIN_DIVIDER_THICKNESS,
  MIN_IMAGE_WIDTH,
  MIN_SPACER_HEIGHT,
  MIN_WIDTH,
  runeCount,
} from "@/lib/email-design/limits";
import { emailLook } from "@/lib/email-design/look";
import type { CustomField } from "@/lib/email-design/merge-tags";
import { paragraphText } from "@/lib/email-design/rich-text";
import {
  COLUMN_RATIOS,
  SOCIAL_NETWORKS,
  type Align,
  type Block,
  type ColorSetting,
  type ColumnRatio,
  type Document,
  type Padding,
  type Settings,
  type SocialLink,
  type SocialNetwork,
} from "@/lib/email-design/types";
import { cn } from "@/lib/utils";

import { blockSummary, KIND_ICONS } from "./block-meta";
import { ChoiceField, ColorField, FieldGroup, RangeField, SelectField, TextField } from "./fields";
import { ImageSource } from "./image-source";
import { TextAlignCenter, TextAlignRight } from "./glyphs";

export interface InspectorProps {
  document: Document;
  selected: Block | null;
  insideColumns: boolean;
  customFields: readonly CustomField[];
  readOnly: boolean;
  onSettings: (patch: Partial<Settings>, group: string) => void;
  onBlock: (id: string, update: (block: Block) => Block, group: string) => void;
  onColumnsRatio: (id: string, ratio: ColumnRatio) => void;
  onShowDocument: () => void;
}

type Change = (update: (block: Block) => Block, field: string) => void;

function without<T extends object>(value: T, key: keyof T, next: unknown): T {
  const out = { ...value } as Record<string, unknown>;
  if (next === undefined || next === "" || next === false) delete out[key as string];
  else out[key as string] = next;
  return out as T;
}

function useAlignOptions() {
  const t = useTranslations("emailEditor.inspector.align");
  return [
    { value: "left" as Align, label: "", title: t("left"), icon: <TextAlignLeft className="h-4 w-4" /> },
    { value: "center" as Align, label: "", title: t("center"), icon: <TextAlignCenter className="h-4 w-4" /> },
    { value: "right" as Align, label: "", title: t("right"), icon: <TextAlignRight className="h-4 w-4" /> },
  ];
}

function AlignField({ value, onChange, fallback, disabled }: { value: Align | undefined; onChange: (value: Align) => void; fallback: Align; disabled: boolean }) {
  const t = useTranslations("emailEditor.inspector");
  return <ChoiceField label={t("fields.align")} fieldKey="align" options={useAlignOptions()} value={value ?? fallback} onChange={onChange} disabled={disabled} />;
}

function DocumentInspector({ document, customFields, readOnly, onSettings }: Pick<InspectorProps, "document" | "customFields" | "readOnly" | "onSettings">) {
  const t = useTranslations("emailEditor.inspector");
  const settings = document.settings;
  const color = (key: ColorSetting, label: string) => (
    <ColorField
      key={key}
      label={label}
      fieldKey={`settings.${key}`}
      value={settings[key]}
      inherited={DEFAULT_SETTINGS[key]}
      optional
      disabled={readOnly}
      onChange={(value) => onSettings({ [key]: value }, `settings.${key}`)}
    />
  );
  return (
    <>
      <FieldGroup title={t("groups.inbox")}>
        <TextField
          label={t("fields.preheader")}
          fieldKey="settings.preheader"
          value={settings.preheader ?? ""}
          maxLength={MAX_PREHEADER_RUNES}
          showCount
          multiline
          rows={2}
          mergeTags={customFields}
          disabled={readOnly}
          onChange={(value) => onSettings({ preheader: value }, "settings.preheader")}
        />
        <p className="text-2xs leading-relaxed text-muted-foreground">{t("help.preheader")}</p>
      </FieldGroup>
      <FieldGroup title={t("groups.layout")}>
        <RangeField
          label={t("fields.width")}
          fieldKey="settings.width"
          value={settings.width || DEFAULT_SETTINGS.width}
          min={MIN_WIDTH}
          max={MAX_WIDTH}
          unit="px"
          disabled={readOnly}
          onChange={(value) => onSettings({ width: value }, "settings.width")}
        />
        <SelectField
          label={t("fields.font")}
          fieldKey="settings.font_family"
          value={settings.font_family ?? DEFAULT_SETTINGS.font_family}
          options={FONT_FAMILIES.map((id) => ({ value: id, label: t(`fonts.${id}`) }))}
          disabled={readOnly}
          onChange={(value) => onSettings({ font_family: value }, "settings.font_family")}
        />
      </FieldGroup>
      <FieldGroup title={t("groups.colors")}>
        {color("background_color", t("fields.backgroundColor"))}
        {color("content_background_color", t("fields.contentBackgroundColor"))}
        {color("text_color", t("fields.textColor"))}
        {color("link_color", t("fields.linkColor"))}
      </FieldGroup>
      <FieldGroup title={t("groups.buttons")}>
        {color("button_color", t("fields.buttonColor"))}
        {color("button_text_color", t("fields.buttonTextColor"))}
      </FieldGroup>
    </>
  );
}

function RatioPicker({ value, onChange, disabled }: { value: ColumnRatio; onChange: (ratio: ColumnRatio) => void; disabled: boolean }) {
  const t = useTranslations("emailEditor.inspector");
  return (
    <div data-email-field="ratio">
      <p className="mb-1.5 text-xs font-medium text-foreground">{t("fields.ratio")}</p>
      <div role="group" aria-label={t("fields.ratio")} className="grid grid-cols-2 gap-2">
        {COLUMN_RATIOS.map((ratio) => {
          const active = ratio === value;
          return (
            <button
              key={ratio}
              type="button"
              aria-pressed={active}
              aria-label={t(`ratios.${ratio}`)}
              title={t(`ratios.${ratio}`)}
              disabled={disabled}
              onClick={() => onChange(ratio)}
              className={cn(
                "flex h-14 flex-col justify-between rounded-[--radius] border p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                active ? "border-primary-edge bg-muted" : "border-control-edge bg-card hover:bg-muted dark:bg-muted",
              )}
            >
              <span aria-hidden className="flex h-5 gap-1">
                {ratio.split("-").map((share, index) => (
                  <span key={index} className={cn("h-full rounded-[3px]", active ? "bg-primary" : "bg-border-strong")} style={{ flex: Number(share) }} />
                ))}
              </span>
              <span className={cn("readout text-left text-2xs", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{ratio.replace(/-/g, " / ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SocialLinksField({ links, onChange, disabled }: { links: SocialLink[]; onChange: (links: SocialLink[]) => void; disabled: boolean }) {
  const t = useTranslations("emailEditor.inspector");
  const tn = useTranslations("emailEditor.social.networks");
  const set = (index: number, patch: Partial<SocialLink>) =>
    onChange(
      links.map((link, at) => {
        if (at !== index) return link;
        const merged = { ...link, ...patch };
        return without(merged, "label", merged.label);
      }),
    );
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div data-email-field="links" className="space-y-3">
      {links.map((link, index) => (
        <div key={index} className="space-y-2 rounded-[--radius] border border-border p-2.5" data-email-field={`links.${index}`}>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1" data-email-field={`links.${index}.network`}>
              <ElevatedSelect label={t("fields.network")} value={link.network} disabled={disabled} onValueChange={(network) => set(index, { network: network as SocialNetwork })}>
                {SOCIAL_NETWORKS.map((network) => (
                  <ElevatedSelectItem key={network} value={network}>
                    {tn(network)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            <IconAction label={t("social.moveUp")} disabled={disabled || index === 0} onClick={() => move(index, -1)}>
              <ArrowUp className="h-4 w-4" />
            </IconAction>
            <IconAction label={t("social.moveDown")} disabled={disabled || index === links.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown className="h-4 w-4" />
            </IconAction>
            <IconAction label={t("social.remove")} disabled={disabled} onClick={() => onChange(links.filter((_, at) => at !== index))}>
              <Trash className="h-4 w-4" />
            </IconAction>
          </div>
          <ElevatedInput
            label={t("fields.url")}
            type="url"
            inputMode="url"
            data-email-field={`links.${index}.url`}
            value={link.url}
            maxLength={MAX_HREF_RUNES}
            disabled={disabled}
            onChange={(event) => set(index, { url: event.target.value })}
          />
          <ElevatedInput
            label={t("fields.socialLabel")}
            data-email-field={`links.${index}.label`}
            value={link.label ?? ""}
            maxLength={MAX_SOCIAL_LABEL_RUNES}
            disabled={disabled}
            onChange={(event) => set(index, { label: event.target.value })}
          />
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        iconVisible
        icon={<Plus />}
        title={t("social.add")}
        disabled={disabled}
        onClick={() => onChange([...links, { network: "website", url: "https://" }])}
      />
    </div>
  );
}

function IconAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BlockFields({ block, change, customFields, readOnly, look, onColumnsRatio }: { block: Block; change: Change; customFields: readonly CustomField[]; readOnly: boolean; look: ReturnType<typeof emailLook>; onColumnsRatio: (ratio: ColumnRatio) => void }) {
  const t = useTranslations("emailEditor.inspector");
  switch (block.kind) {
    case "heading": {
      const heading = block.heading;
      const set = (key: keyof typeof heading, value: unknown) => change((current) => (current.kind === "heading" ? { ...current, heading: without(current.heading, key, value) } : current), String(key));
      return (
        <FieldGroup title={t("groups.content")}>
          <TextField label={t("fields.headingText")} fieldKey="text" value={heading.text} maxLength={MAX_HEADING_RUNES} showCount mergeTags={customFields} disabled={readOnly} onChange={(value) => change((current) => (current.kind === "heading" ? { ...current, heading: { ...current.heading, text: value } } : current), "text")} />
          <ChoiceField
            label={t("fields.level")}
            fieldKey="level"
            disabled={readOnly}
            value={String(heading.level) as "1" | "2" | "3"}
            options={(["1", "2", "3"] as const).map((level) => ({ value: level, label: t(`levels.${level}`) }))}
            onChange={(level) => change((current) => (current.kind === "heading" ? { ...current, heading: { ...current.heading, level: Number(level) } } : current), "level")}
          />
          <AlignField value={heading.align} fallback="left" disabled={readOnly} onChange={(align) => set("align", align)} />
          <ColorField label={t("fields.headingColor")} fieldKey="color" value={heading.color} inherited={look.text} optional disabled={readOnly} onChange={(value) => set("color", value)} />
        </FieldGroup>
      );
    }
    case "text": {
      const total = block.text.paragraphs.reduce((sum, paragraph) => sum + runeCount(paragraphText(paragraph)), 0);
      return (
        <FieldGroup
          title={t("groups.content")}
          meta={
            <span className="readout text-2xs text-muted-foreground">
              {total}/{MAX_TEXT_BLOCK_RUNES}
            </span>
          }
        >
          <p className="text-xs leading-relaxed text-muted-foreground">{t("help.text")}</p>
          <AlignField
            value={block.text.align}
            fallback="left"
            disabled={readOnly}
            onChange={(align) => change((current) => (current.kind === "text" ? { ...current, text: without(current.text, "align", align) } : current), "align")}
          />
        </FieldGroup>
      );
    }
    case "button": {
      const button = block.button;
      const set = (key: keyof typeof button, value: unknown) => change((current) => (current.kind === "button" ? { ...current, button: without(current.button, key, value) } : current), String(key));
      return (
        <>
          <FieldGroup title={t("groups.content")}>
            <TextField label={t("fields.buttonLabel")} fieldKey="label" value={button.label} maxLength={MAX_BUTTON_LABEL_RUNES} showCount mergeTags={customFields} disabled={readOnly} onChange={(value) => change((current) => (current.kind === "button" ? { ...current, button: { ...current.button, label: value } } : current), "label")} />
            <TextField label={t("fields.href")} fieldKey="href" type="url" inputMode="url" value={button.href} maxLength={MAX_HREF_RUNES} help={t("help.href")} disabled={readOnly} onChange={(value) => change((current) => (current.kind === "button" ? { ...current, button: { ...current.button, href: value } } : current), "href")} />
          </FieldGroup>
          <FieldGroup title={t("groups.style")}>
            <AlignField value={button.align} fallback="center" disabled={readOnly} onChange={(align) => set("align", align)} />
            <ChoiceField
              label={t("fields.buttonWidth")}
              fieldKey="full_width"
              disabled={readOnly}
              value={button.full_width ? "full" : "auto"}
              options={[
                { value: "auto", label: t("buttonWidth.auto") },
                { value: "full", label: t("buttonWidth.full") },
              ]}
              onChange={(mode) => set("full_width", mode === "full")}
            />
            <ColorField label={t("fields.buttonColor")} fieldKey="color" value={button.color} inherited={look.button} optional disabled={readOnly} onChange={(value) => set("color", value)} />
            <ColorField label={t("fields.buttonTextColor")} fieldKey="text_color" value={button.text_color} inherited={look.buttonText} optional disabled={readOnly} onChange={(value) => set("text_color", value)} />
          </FieldGroup>
        </>
      );
    }
    case "image": {
      const image = block.image;
      const set = (key: keyof typeof image, value: unknown) => change((current) => (current.kind === "image" ? { ...current, image: key === "src" || key === "alt" ? { ...current.image, [key]: value } : without(current.image, key, value) } : current), String(key));
      return (
        <>
          <FieldGroup title={t("groups.content")}>
            <TextField label={t("fields.src")} fieldKey="src" type="url" inputMode="url" value={image.src} maxLength={MAX_HREF_RUNES} help={t("help.src")} disabled={readOnly} onChange={(value) => set("src", value)} />
            <ImageSource disabled={readOnly} onPick={(url) => set("src", url)} />
            <TextField label={t("fields.alt")} fieldKey="alt" value={image.alt} maxLength={MAX_ALT_RUNES} showCount mergeTags={customFields} disabled={readOnly} onChange={(value) => set("alt", value)} />
            <TextField label={t("fields.imageHref")} fieldKey="href" type="url" inputMode="url" value={image.href ?? ""} maxLength={MAX_HREF_RUNES} help={t("help.optionalHref")} disabled={readOnly} onChange={(value) => set("href", value)} />
          </FieldGroup>
          <FieldGroup title={t("groups.style")}>
            <RangeField label={t("fields.imageWidth")} fieldKey="width" value={image.width} min={MIN_IMAGE_WIDTH} max={MAX_IMAGE_WIDTH} unit="%" disabled={readOnly} onChange={(value) => set("width", value)} />
            <AlignField value={image.align} fallback="center" disabled={readOnly} onChange={(align) => set("align", align)} />
          </FieldGroup>
        </>
      );
    }
    case "divider": {
      const divider = block.divider;
      return (
        <FieldGroup title={t("groups.style")}>
          <ColorField
            label={t("fields.dividerColor")}
            fieldKey="color"
            value={divider.color}
            inherited={DEFAULT_DIVIDER_COLOR}
            optional
            disabled={readOnly}
            onChange={(value) => change((current) => (current.kind === "divider" ? { ...current, divider: without(current.divider, "color", value) } : current), "color")}
          />
          <RangeField
            label={t("fields.thickness")}
            fieldKey="thickness"
            value={divider.thickness}
            min={MIN_DIVIDER_THICKNESS}
            max={MAX_DIVIDER_THICKNESS}
            unit="px"
            disabled={readOnly}
            onChange={(value) => change((current) => (current.kind === "divider" ? { ...current, divider: { ...current.divider, thickness: value } } : current), "thickness")}
          />
        </FieldGroup>
      );
    }
    case "spacer":
      return (
        <FieldGroup title={t("groups.style")}>
          <RangeField
            label={t("fields.height")}
            fieldKey="height"
            value={block.spacer.height}
            min={MIN_SPACER_HEIGHT}
            max={MAX_SPACER_HEIGHT}
            unit="px"
            disabled={readOnly}
            onChange={(value) => change((current) => (current.kind === "spacer" ? { ...current, spacer: { height: value } } : current), "height")}
          />
        </FieldGroup>
      );
    case "columns":
      return (
        <FieldGroup title={t("groups.layout")}>
          <RatioPicker value={block.columns.ratio} disabled={readOnly} onChange={onColumnsRatio} />
          <p className="text-2xs leading-relaxed text-muted-foreground">{t("help.columns", { count: columnCount(block.columns.ratio) })}</p>
        </FieldGroup>
      );
    case "social":
      return (
        <>
          <FieldGroup title={t("groups.links")}>
            <SocialLinksField links={block.social.links} disabled={readOnly} onChange={(links) => change((current) => (current.kind === "social" ? { ...current, social: { ...current.social, links } } : current), "links")} />
          </FieldGroup>
          <FieldGroup title={t("groups.style")}>
            <AlignField value={block.social.align} fallback="center" disabled={readOnly} onChange={(align) => change((current) => (current.kind === "social" ? { ...current, social: without(current.social, "align", align) } : current), "align")} />
          </FieldGroup>
        </>
      );
    case "footer": {
      const footer = block.footer;
      const set = (key: "company_name" | "address" | "text", value: string) =>
        change((current) => (current.kind === "footer" ? { ...current, footer: key === "text" ? without(current.footer, "text", value) : { ...current.footer, [key]: value } } : current), key);
      return (
        <FieldGroup title={t("groups.content")}>
          <TextField label={t("fields.company")} fieldKey="company_name" value={footer.company_name} maxLength={MAX_COMPANY_RUNES} disabled={readOnly} onChange={(value) => set("company_name", value)} />
          <TextField label={t("fields.address")} fieldKey="address" value={footer.address} maxLength={MAX_ADDRESS_RUNES} multiline rows={2} disabled={readOnly} onChange={(value) => set("address", value)} />
          <TextField label={t("fields.footerText")} fieldKey="text" value={footer.text ?? ""} maxLength={MAX_FOOTER_TEXT_RUNES} showCount multiline rows={3} mergeTags={customFields} disabled={readOnly} onChange={(value) => set("text", value)} />
          <p className="flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
            <Envelope className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("help.unsubscribe")}
          </p>
        </FieldGroup>
      );
    }
  }
}

function AppearanceFields({ block, insideColumns, change, readOnly, look }: { block: Block; insideColumns: boolean; change: Change; readOnly: boolean; look: ReturnType<typeof emailLook> }) {
  const t = useTranslations("emailEditor.inspector");
  const fallback: Padding = insideColumns ? "s" : "m";
  return (
    <FieldGroup title={t("groups.appearance")}>
      {block.kind !== "spacer" ? (
        <ChoiceField
          label={t("fields.padding")}
          fieldKey="padding"
          disabled={readOnly}
          value={block.padding ?? fallback}
          options={(["s", "m", "l"] as const).map((padding) => ({ value: padding, label: t(`paddings.${padding}`) }))}
          onChange={(padding) => change((current) => ({ ...current, padding }), "padding")}
        />
      ) : null}
      <ColorField
        label={t("fields.blockBackground")}
        fieldKey="background_color"
        value={block.background_color}
        inherited={look.content}
        optional
        disabled={readOnly}
        onChange={(value) => change((current) => without(current, "background_color", value), "background_color")}
      />
    </FieldGroup>
  );
}

export function Inspector({ document, selected, insideColumns, customFields, readOnly, onSettings, onBlock, onColumnsRatio, onShowDocument }: InspectorProps) {
  const t = useTranslations("emailEditor");
  const look = emailLook(document.settings, "desktop");
  if (!selected) {
    return (
      <div>
        <header className="flex items-start gap-3 px-4 pb-3 pt-4">
          <span className="mt-0.5 text-muted-foreground">
            <Envelope className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-foreground">{t("inspector.documentTitle")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("inspector.documentDescription")}</p>
          </div>
        </header>
        <DocumentInspector document={document} customFields={customFields} readOnly={readOnly} onSettings={onSettings} />
      </div>
    );
  }
  const Glyph = KIND_ICONS[selected.kind];
  const summary = blockSummary(selected);
  const change: Change = (update, field) => onBlock(selected.id, update, `${selected.id}:${field}`);
  return (
    <div key={selected.id}>
      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="mt-0.5 text-muted-foreground">
          <Glyph className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-foreground">{t(`palette.kinds.${selected.kind}.label`)}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary || t(`palette.kinds.${selected.kind}.description`)}</p>
        </div>
      </header>
      <BlockFields block={selected} change={change} customFields={customFields} readOnly={readOnly} look={look} onColumnsRatio={(ratio) => onColumnsRatio(selected.id, ratio)} />
      <AppearanceFields block={selected} insideColumns={insideColumns} change={change} readOnly={readOnly} look={look} />
      <div className="border-t border-border px-4 py-3">
        <Button variant="ghost" size="sm" iconVisible icon={<Envelope />} title={t("inspector.showDocument")} onClick={onShowDocument} />
      </div>
    </div>
  );
}
