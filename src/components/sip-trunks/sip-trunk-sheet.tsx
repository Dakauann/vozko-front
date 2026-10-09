"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Phone } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSelect, { ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { createSipTrunkAction, updateSipTrunkAction } from "@/app/actions/sip-trunks";
import { toast } from "sonner";
import {
  draftFromTrunk,
  emptyTrunkDraft,
  payloadFromDraft,
  validateDraft,
  type SipTrunkDraft,
  type SipTrunkDraftField,
} from "@/lib/sip-trunks/form";
import { SIP_CODECS, type SipTrunk } from "@/lib/sip-trunks/types";
import { cn } from "@/lib/utils";

interface SipTrunkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trunk: SipTrunk | null;
  onSaved: () => void;
}

export function SipTrunkSheet({ open, onOpenChange, trunk, onSaved }: SipTrunkSheetProps) {
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-[560px]">
        {open ? <SipTrunkForm key={trunk?.id ?? "new"} trunk={trunk} onClose={() => onOpenChange(false)} onSaved={onSaved} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function SipTrunkForm({ trunk, onClose, onSaved }: { trunk: SipTrunk | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("sipTrunks.form");
  const editing = trunk !== null;
  const [draft, setDraft] = useState<SipTrunkDraft>(() => (trunk ? draftFromTrunk(trunk) : emptyTrunkDraft()));
  const [invalid, setInvalid] = useState<SipTrunkDraftField[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, startSaving] = useTransition();

  const update = <K extends keyof SipTrunkDraft>(field: K, value: SipTrunkDraft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const errorFor = (field: SipTrunkDraftField) => (invalid.includes(field) ? t(`invalid.${field}`) : undefined);

  const save = () => {
    const problems = validateDraft(draft, editing);
    setInvalid(problems);
    if (problems.length > 0) return;
    startSaving(async () => {
      const payload = payloadFromDraft(draft);
      const result = trunk ? await updateSipTrunkAction(trunk.id, payload) : await createSipTrunkAction(payload);
      if (result.error) {
        toast.error(t("saveFailed"), { description: result.error });
        return;
      }
      toast(editing ? t("updated") : t("created"), { description: draft.name.trim() });
      onClose();
      onSaved();
    });
  };

  return (
    <>
      <ElevatedSheetHeader>
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
            <Phone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <ElevatedSheetTitle>{editing ? t("editTitle") : t("createTitle")}</ElevatedSheetTitle>
            <ElevatedSheetDescription>{t("subtitle")}</ElevatedSheetDescription>
          </div>
        </div>
      </ElevatedSheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <ElevatedInput label={t("name")} value={draft.name} onChange={(e) => update("name", e.target.value)} error={errorFor("name")} />

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <ElevatedInput label={t("host")} placeholder="sip.provider.com" value={draft.host} onChange={(e) => update("host", e.target.value)} error={errorFor("host")} />
          <ElevatedInput label={t("port")} placeholder="5060" inputMode="numeric" value={draft.port} onChange={(e) => update("port", e.target.value)} error={errorFor("port")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ElevatedSelect label={t("transport")} value={draft.transport} onValueChange={(value) => update("transport", value as SipTrunkDraft["transport"])}>
            <ElevatedSelectItem value="UDP">UDP</ElevatedSelectItem>
            <ElevatedSelectItem value="TCP">TCP</ElevatedSelectItem>
          </ElevatedSelect>
          <ElevatedSelect label={t("trunkType")} value={draft.trunkType} onValueChange={(value) => update("trunkType", value as SipTrunkDraft["trunkType"])}>
            <ElevatedSelectItem value="BIDIRECTIONAL">{t("types.BIDIRECTIONAL")}</ElevatedSelectItem>
            <ElevatedSelectItem value="OUTBOUND">{t("types.OUTBOUND")}</ElevatedSelectItem>
            <ElevatedSelectItem value="INBOUND">{t("types.INBOUND")}</ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ElevatedInput label={t("username")} autoComplete="off" value={draft.username} onChange={(e) => update("username", e.target.value)} error={errorFor("username")} />
          <ElevatedInput
            label={editing && trunk?.hasPassword ? t("passwordKeep") : t("password")}
            type="password"
            autoComplete="new-password"
            value={draft.password}
            onChange={(e) => update("password", e.target.value)}
            error={errorFor("password")}
          />
        </div>

        <ElevatedInput label={t("domain")} placeholder={t("domainPlaceholder")} value={draft.domain} onChange={(e) => update("domain", e.target.value)} />

        <ElevatedSwitch label={t("enabled")} description={t("enabledHint")} checked={draft.enabled} onCheckedChange={(checked) => update("enabled", checked)} />

        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          aria-expanded={showAdvanced}
          className="flex w-full items-center justify-between rounded-[--radius] border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {t("advanced")}
          <CaretDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
        </button>

        {showAdvanced ? (
          <div className="space-y-4">
            <ElevatedSwitch label={t("skipRegistration")} description={t("skipRegistrationHint")} checked={draft.skipRegistration} onCheckedChange={(checked) => update("skipRegistration", checked)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ElevatedInput label={t("authUsername")} value={draft.authUsername} onChange={(e) => update("authUsername", e.target.value)} />
              <ElevatedInput label={t("outboundProxy")} placeholder="proxy.provider.com:5060" value={draft.outboundProxy} onChange={(e) => update("outboundProxy", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ElevatedInput label={t("stripPrefix")} placeholder="+55" value={draft.stripPrefix} onChange={(e) => update("stripPrefix", e.target.value)} />
              <ElevatedInput label={t("addPrefix")} placeholder="0" value={draft.addPrefix} onChange={(e) => update("addPrefix", e.target.value)} />
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t("codecs")}</legend>
              <div className="flex flex-wrap gap-2">
                {SIP_CODECS.map((codec) => {
                  const selected = draft.codecs.includes(codec);
                  return (
                    <button
                      key={codec}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => update("codecs", selected ? draft.codecs.filter((c) => c !== codec) : [...draft.codecs, codec])}
                      className={cn(
                        "rounded-[--radius] border px-3 py-1.5 text-xs font-semibold transition-colors",
                        selected ? "border-primary bg-muted text-primary-ink" : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {codec}
                    </button>
                  );
                })}
              </div>
              <p className={cn("mt-1.5 text-xs", invalid.includes("codecs") ? "text-destructive-ink" : "text-muted-foreground")}>
                {invalid.includes("codecs") ? t("invalid.codecs") : t("codecsHint")}
              </p>
            </fieldset>

            <ElevatedSelect label={t("srtp")} value={draft.srtpMode || "OFF"} onValueChange={(value) => update("srtpMode", value === "OFF" ? "" : (value as SipTrunkDraft["srtpMode"]))}>
              <ElevatedSelectItem value="OFF">{t("srtpModes.off")}</ElevatedSelectItem>
              <ElevatedSelectItem value="OPTIONAL">{t("srtpModes.optional")}</ElevatedSelectItem>
              <ElevatedSelectItem value="REQUIRED">{t("srtpModes.required")}</ElevatedSelectItem>
            </ElevatedSelect>

            <ElevatedSwitch label={t("stun")} description={t("stunHint")} checked={draft.stunEnabled} onCheckedChange={(checked) => update("stunEnabled", checked)} />
            <ElevatedInput label={t("publicAddress")} placeholder="203.0.113.10" value={draft.publicAddress} onChange={(e) => update("publicAddress", e.target.value)} />
            <ElevatedTextarea
              label={t("inboundSources")}
              placeholder={"203.0.113.0/24\n198.51.100.7"}
              value={draft.inboundSources}
              onChange={(e) => update("inboundSources", e.target.value)}
              autoResize
              maxHeight={160}
            />
            <p className="-mt-2 text-xs text-muted-foreground">{t("inboundSourcesHint")}</p>
          </div>
        ) : null}
      </div>

      <ElevatedSheetFooter>
        <Button variant="ghost" title={t("cancel")} onClick={onClose} disabled={saving} />
        <Button variant="primary" title={saving ? t("saving") : t("save")} onClick={save} disabled={saving} />
      </ElevatedSheetFooter>
    </>
  );
}
