"use client";

import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { CampaignMediaPicker, MEDIA_ACCEPT } from "@/components/campaigns/CampaignMediaPicker";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { MessageVariantsEditor, variantsAgree } from "@/components/unofficial-whatsapp/message-variants-editor";
import type { LeadImportOptions, LeadImportSeedScript } from "@/lib/leads/imports";

export const SEED_MEDIA_KINDS = ["image", "video", "audio", "document", "sticker"] as const;

export type SeedMediaKind = (typeof SEED_MEDIA_KINDS)[number];

export type SavedSeedScript = "kept" | "stale" | null;

const MAX_SEED_VARIANTS = 10;

const SEED_MESSAGE_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

const SEED_CONTEXT_MAX = 600;

export interface SeedDraft {
  seedInbox: boolean;
  seedConversations: boolean;
  bodies: string[];
  context: string;
  maxMessages: number;
  mediaKind: SeedMediaKind;
  mediaId?: string;
  mediaName?: string;
  savedScript: SavedSeedScript;
}

export const EMPTY_SEED_DRAFT: SeedDraft = {
  seedInbox: false,
  seedConversations: false,
  bodies: [""],
  context: "",
  maxMessages: 4,
  mediaKind: "image",
  savedScript: null,
};

function isSeedMediaKind(kind: string): kind is SeedMediaKind {
  return (SEED_MEDIA_KINDS as readonly string[]).includes(kind);
}

export function seedDraftOf(script: LeadImportSeedScript): Pick<SeedDraft, "bodies" | "context" | "maxMessages" | "mediaKind" | "mediaId"> {
  const kind = script.attachment?.kind ?? "";
  const attached = script.attachment && isSeedMediaKind(kind);
  return {
    bodies: script.bodies.length > 0 ? [...script.bodies] : [""],
    context: script.context ?? "",
    maxMessages: script.maxMessages,
    mediaKind: attached ? kind : EMPTY_SEED_DRAFT.mediaKind,
    mediaId: attached ? script.attachment?.mediaId : undefined,
  };
}

export function seedScriptOf(draft: SeedDraft, options: LeadImportOptions): LeadImportSeedScript | undefined {
  if (!options.seedInbox || !options.seedConversations || !draft.seedInbox || !draft.seedConversations) return undefined;
  const bodies = draft.bodies.map((body) => body.trim()).filter(Boolean);
  const context = draft.context.trim();
  return {
    bodies,
    maxMessages: draft.maxMessages,
    ...(context ? { context } : {}),
    ...(draft.mediaId ? { attachment: { mediaId: draft.mediaId, kind: draft.mediaKind } } : {}),
  };
}

export function seedScriptBlocks(draft: SeedDraft, options: LeadImportOptions): boolean {
  const script = seedScriptOf(draft, options);
  return script !== undefined && (script.bodies.length === 0 || !variantsAgree(script.bodies));
}

export function ImportSeedOptions({
  options,
  draft,
  onChange,
  disabled,
  maxSeeded,
}: {
  options: LeadImportOptions;
  draft: SeedDraft;
  onChange: (next: SeedDraft) => void;
  disabled?: boolean;
  maxSeeded: number | null;
}) {
  const t = useTranslations("leadsPage.import");
  const format = useFormatter();
  if (!options.seedInbox) return null;
  const set = (patch: Partial<SeedDraft>) => onChange({ ...draft, ...patch });
  const scripting = options.seedConversations && draft.seedInbox;
  const rewriting = draft.savedScript === "stale" && draft.bodies.every((body) => !body.trim());

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
        <Checkbox
          className="mt-0.5"
          checked={draft.seedInbox}
          disabled={disabled}
          onCheckedChange={(next) => {
            const on = next === true;
            set(on ? { seedInbox: true } : { seedInbox: false, seedConversations: false, savedScript: null });
          }}
        />
        <span>
          {t("seedInbox.label")}
          <span className="mt-0.5 block text-xs text-muted-foreground">{t("seedInbox.help")}</span>
        </span>
      </label>

      {scripting ? (
        <div className="space-y-3 rounded-[--radius] border border-border bg-card p-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
            <Checkbox
              className="mt-0.5"
              checked={draft.seedConversations}
              disabled={disabled}
              onCheckedChange={(next) => set({ seedConversations: next === true, savedScript: null })}
            />
            <span>
              <span className="flex flex-wrap items-center gap-2">
                {t("seedConversations.label")}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
                  {t("seedConversations.adminOnly")}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t("seedConversations.help")}</span>
            </span>
          </label>

          {draft.seedConversations && draft.savedScript === "kept" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t("seedConversations.kept")}</p>
              <Button
                variant="secondary"
                size="sm"
                title={t("seedConversations.writeNew")}
                onClick={() => set({ savedScript: null })}
                disabled={disabled}
              />
            </div>
          ) : null}

          {draft.seedConversations && draft.savedScript !== "kept" ? (
            <div className="space-y-3 border-t border-border pt-3">
              {rewriting ? <p className="text-xs text-warning-ink">{t("seedConversations.rewrite")}</p> : null}
              <MessageVariantsEditor
                bodies={draft.bodies}
                onChange={(bodies) => set({ bodies })}
                max={MAX_SEED_VARIANTS}
                disabled={disabled}
                rows={3}
                labels={{
                  title: t("seedConversations.variantsTitle"),
                  help: t("seedConversations.variantsHelp"),
                  addVariant: t("seedConversations.addVariant"),
                  removeVariant: t("seedConversations.removeVariant"),
                  variantLabel: (index) => t("seedConversations.variantLabel", { index }),
                  bodyPlaceholder: t("seedConversations.bodyPlaceholder"),
                  mismatch: t("seedConversations.variantsMismatch"),
                  variablesDetected: () => t("seedConversations.nameVariable"),
                }}
              />

              <ElevatedInput
                label={t("seedConversations.contextLabel")}
                value={draft.context}
                onChange={(event) => set({ context: event.target.value })}
                disabled={disabled}
                controlSize="sm"
                maxLength={SEED_CONTEXT_MAX}
                placeholder={t("seedConversations.contextPlaceholder")}
              />

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-medium text-foreground">{t("seedConversations.mediaTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("seedConversations.mediaHelp")}</p>
                <ElevatedSelect
                  label={t("seedConversations.mediaKind")}
                  value={draft.mediaKind}
                  disabled={disabled}
                  onValueChange={(value) =>
                    set({ mediaKind: value as SeedMediaKind, mediaId: undefined, mediaName: undefined })
                  }
                >
                  {SEED_MEDIA_KINDS.map((kind) => (
                    <ElevatedSelectItem key={kind} value={kind}>
                      {t(`seedConversations.mediaKinds.${kind}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
                <CampaignMediaPicker
                  kind={draft.mediaKind}
                  mediaId={draft.mediaId}
                  fileName={draft.mediaName ?? (draft.mediaId ? t("seedConversations.savedMedia") : undefined)}
                  accept={MEDIA_ACCEPT[draft.mediaKind] ?? "*/*"}
                  disabled={disabled}
                  onChange={(next) => set({ mediaId: next.mediaId, mediaName: next.fileName })}
                  labels={{
                    upload: t("seedConversations.mediaUpload"),
                    uploading: t("seedConversations.mediaUploading"),
                    remove: t("seedConversations.mediaRemove"),
                    failed: t("seedConversations.mediaFailed"),
                  }}
                />
              </div>

              <ElevatedSelect
                label={t("seedConversations.maxMessages")}
                value={String(draft.maxMessages)}
                onValueChange={(value) => set({ maxMessages: Number(value) })}
                disabled={disabled}
              >
                {SEED_MESSAGE_OPTIONS.map((count) => (
                  <ElevatedSelectItem key={count} value={String(count)}>
                    {t("seedConversations.messageCount", { count })}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>

              <p className="text-2xs text-muted-foreground">
                {maxSeeded === null
                  ? t("seedConversations.costNoticeNoLimit")
                  : t("seedConversations.costNotice", { max: format.number(maxSeeded) })}
              </p>

              {!rewriting && seedScriptBlocks(draft, options) ? (
                <p className="text-xs font-semibold text-destructive-ink">{t("seedConversations.invalid")}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
