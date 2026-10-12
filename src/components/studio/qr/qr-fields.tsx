"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assetNaturalSize } from "@/components/studio/canvas/asset-images";
import { logoMax, modulePixels, phoneDigits, qrContent, qrContrast, qrIssue, qrScanProblem, withEcc, withLogo, QR_DEFAULTS, QR_ECC_LEVELS, QR_LIMITS, type QrEcc, type QrLink, type QrLinkKind, type QrScanProblem, type QrSpec } from "@/lib/studio/qr";
import { QR_BYTE_CAPACITY, qrBytes } from "@/lib/studio/qr-encoder";
import { cn } from "@/lib/utils";

import { ColorField, InspectorSection, Notice, NumberField, OUTLINE_BUTTON_CLASS, SelectField, TextField } from "../image/controls";
import { ImageSourcePicker } from "../image/image-source-picker";
import { ShortLinkField } from "./short-link-field";

const PERCENT = 100;
const MODES: readonly QrLinkKind[] = ["shortLink", "whatsapp", "url", "text"];

export interface QrFieldsProps {
  spec: QrSpec;
  disabled: boolean;
  sidePx: number;
  fresh?: boolean;
  onChange: (spec: QrSpec) => boolean;
}

function TextArea({ label, value, disabled, onCommit }: { label: string; value: string; disabled: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="block space-y-1">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <textarea
        value={draft}
        disabled={disabled}
        rows={3}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        className="w-full resize-y rounded-[--radius] border border-control-edge bg-transparent px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

export function QrFields({ spec, disabled, sidePx, fresh, onChange }: QrFieldsProps) {
  const t = useTranslations("studio.qr");
  const [mode, setMode] = useState<QrLinkKind>(fresh ? "shortLink" : spec.link.kind);
  const [problem, setProblem] = useState<QrScanProblem | "invalid" | null>(null);
  const [logoOpen, setLogoOpen] = useState(false);
  const modulePx = modulePixels(spec, sidePx);
  const bytes = qrBytes(qrContent(spec.link)).length;

  const change = (next: QrSpec): boolean => {
    const ok = !qrIssue(next) && onChange(next);
    setProblem(ok ? null : (qrScanProblem(next) ?? "invalid"));
    return ok;
  };
  const relink = (link: QrLink) => change({ ...spec, link });
  const whatsapp = spec.link.kind === "whatsapp" ? spec.link : { kind: "whatsapp" as const, phone: "", message: undefined };

  const pickLogo = async (mediaId: string) => {
    const natural = await assetNaturalSize(mediaId).catch(() => null);
    if (!natural || natural.height <= 0) return false;
    const ok = change(withLogo(spec, { assetId: mediaId, scale: spec.logo?.scale ?? QR_DEFAULTS.logoScale, aspect: natural.width / natural.height }));
    if (ok) setLogoOpen(false);
    return ok;
  };

  return (
    <InspectorSection id="qr" title={t("title")} summary={t(`modes.${spec.link.kind}`)}>
      <SelectField<QrLinkKind> label={t("mode")} value={mode} disabled={disabled} options={MODES.map((kind) => ({ value: kind, label: t(`modes.${kind}`) }))} onChange={setMode} />
      {mode === "shortLink" ? <ShortLinkField link={spec.link} disabled={disabled} autoFocus={fresh} onLink={relink} /> : null}
      {mode === "whatsapp" ? (
        <>
          <TextField key={`phone:${whatsapp.phone}`} label={t("phone")} value={whatsapp.phone} placeholder="5511999998888" disabled={disabled} onCommit={(phone) => relink({ kind: "whatsapp", phone: phoneDigits(phone), ...(whatsapp.message ? { message: whatsapp.message } : {}) })} />
          <TextArea key={`message:${whatsapp.message ?? ""}`} label={t("message")} value={whatsapp.message ?? ""} disabled={disabled || whatsapp.phone === ""} onCommit={(message) => relink({ kind: "whatsapp", phone: whatsapp.phone, ...(message ? { message } : {}) })} />
          <p className="text-2xs text-muted-foreground">{t("phoneHint")}</p>
        </>
      ) : null}
      {mode === "url" ? <TextField key={`url:${spec.link.kind === "url" ? spec.link.url : ""}`} label={t("url")} value={spec.link.kind === "url" ? spec.link.url : ""} placeholder="https://" disabled={disabled} onCommit={(url) => relink({ kind: "url", url: url.trim() })} /> : null}
      {mode === "url" ? <p className="text-2xs text-muted-foreground">{t("urlHint")}</p> : null}
      {mode === "text" ? <TextArea key={`text:${spec.link.kind === "text" ? spec.link.text : ""}`} label={t("text")} value={spec.link.kind === "text" ? spec.link.text : ""} disabled={disabled} onCommit={(text) => relink({ kind: "text", text })} /> : null}
      <p className="break-all text-2xs text-muted-foreground">{t("content", { content: qrContent(spec.link), bytes, capacity: QR_BYTE_CAPACITY[spec.ecc] })}</p>

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("look")}</h4>
      <ColorField label={t("dark")} value={spec.dark} disabled={disabled} onCommit={(dark) => change({ ...spec, dark: dark.slice(0, 7) })} />
      <ColorField label={t("light")} value={spec.light} disabled={disabled} onCommit={(light) => change({ ...spec, light: light.slice(0, 7) })} />
      <p className="text-2xs text-muted-foreground">{t("contrast", { ratio: (qrContrast(spec.dark, spec.light) ?? 0).toFixed(1), minimum: QR_LIMITS.minContrast })}</p>
      <SelectField<QrEcc> label={t("ecc")} value={spec.ecc} disabled={disabled} options={QR_ECC_LEVELS.map((ecc) => ({ value: ecc, label: t(`levels.${ecc}`) }))} onChange={(ecc) => change(withEcc(spec, ecc))} />
      <NumberField label={t("quietZone")} value={spec.quietZone} min={QR_LIMITS.quietZone[0]} max={QR_LIMITS.quietZone[1]} disabled={disabled} onCommit={(quietZone) => change({ ...spec, quietZone: Math.round(quietZone) })} />

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("logo.title")}</h4>
      <Popover open={logoOpen} onOpenChange={setLogoOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled} className={cn(OUTLINE_BUTTON_CLASS, "w-full")}>
            {spec.logo ? t("logo.replace") : t("logo.add")}
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-80">
          <ImageSourcePicker compact uploadLabel={t("logo.upload")} onPick={pickLogo} />
        </PopoverContent>
      </Popover>
      {spec.logo ? (
        <>
          <NumberField label={t("logo.scale")} value={spec.logo.scale * PERCENT} min={QR_LIMITS.logoScale * PERCENT} max={logoMax(spec.ecc) * PERCENT} disabled={disabled} suffix="%" onCommit={(value) => change(withLogo(spec, { ...spec.logo!, scale: value / PERCENT }))} />
          <p className="text-2xs text-muted-foreground">{t("logo.hint", { max: Math.round(logoMax(spec.ecc) * PERCENT) })}</p>
          <button type="button" disabled={disabled} onClick={() => change(withLogo(spec, null))} className={cn(OUTLINE_BUTTON_CLASS, "w-full")}>
            {t("logo.remove")}
          </button>
        </>
      ) : null}

      {problem ? <Notice tone="fault" title={t(`problems.${problem}`)} /> : null}
      {modulePx !== null && modulePx < QR_LIMITS.minModulePx ? <Notice tone="info" title={t("small", { pixels: modulePx.toFixed(1), minimum: QR_LIMITS.minModulePx })} /> : null}
    </InspectorSection>
  );
}
