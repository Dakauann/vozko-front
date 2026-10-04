"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { DotMatrix } from "@/components/brand/circuit";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import PermissionsEditor, { usePermissionMap } from "@/components/elevated-design/permissions-editor";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  Info,
  LinkBreak,
  Stack,
  X,
} from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  BLANK_START,
  RolePresetGallery,
} from "@/components/workspace/role-preset-gallery";
import { RoleTile, useRolePresetCopy } from "@/components/workspace/role-identity";
import { createCustomRole, fetchAvailablePermissions, updateCustomRole } from "@/lib/workspace/client";
import {
  autofillValue,
  buildCreatePayload,
  buildUpdatePayload,
  canLinkPreset,
  capabilitySummary,
  initialRoleSource,
  isPermissionEditingLocked,
  matchingPreset,
  permissionDiff,
  presetPermissions,
  roleSaveError,
  saveBlocker,
  shouldConfirmReplace,
  sourceForChosenPreset,
  type RoleSource,
} from "@/lib/workspace/role-presets";
import type {
  AvailablePermission,
  CustomRole,
  Feature,
  PermissionEntry,
  RolePreset,
} from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

interface Catalog {
  status: "loading" | "ready" | "error";
  permissions: AvailablePermission[];
  features: Feature[];
  presets: RolePreset[];
}

const LOADING_CATALOG: Catalog = { status: "loading", permissions: [], features: [], presets: [] };

type PendingChange =
  | { kind: "preset"; preset: RolePreset }
  | { kind: "blank" }
  | { kind: "link"; preset: RolePreset };

export interface RoleBuilderProps {
  wsId: string;
  role?: CustomRole;
  compact?: boolean;
  onCancel: () => void;
  onSaved: (role: CustomRole | null) => void | Promise<void>;
}

export function RoleBuilder({ wsId, role, compact = false, onCancel, onSaved }: RoleBuilderProps) {
  const t = useTranslations("roleBuilder");
  const tSettings = useTranslations("workspaceSettings");
  const tScope = useTranslations("departmentScope");
  const copy = useRolePresetCopy();
  const editing = Boolean(role);
  const formId = React.useId();

  const [catalog, setCatalog] = React.useState<Catalog>(LOADING_CATALOG);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [stage, setStage] = React.useState<"gallery" | "form">(editing ? "form" : "gallery");
  const [source, setSource] = React.useState<RoleSource>(() => initialRoleSource(role));
  const [name, setName] = React.useState(role?.name ?? "");
  const [description, setDescription] = React.useState(role?.description ?? "");
  const [nameSuggestion, setNameSuggestion] = React.useState("");
  const [descriptionSuggestion, setDescriptionSuggestion] = React.useState("");
  const [nameError, setNameError] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [pending, setPending] = React.useState<PendingChange | null>(null);
  const [showEditor, setShowEditor] = React.useState(false);
  const savingRef = React.useRef(false);

  const {
    permMap,
    togglePermission,
    toggleAllForResource,
    resetPermMap,
    getPermissionEntries,
  } = usePermissionMap(role?.permissions, catalog.permissions);

  React.useEffect(() => {
    let alive = true;
    fetchAvailablePermissions().then((result) => {
      if (!alive) return;
      setCatalog(
        result.error
          ? { ...LOADING_CATALOG, status: "error" }
          : {
              status: "ready",
              permissions: result.permissions,
              features: result.features,
              presets: result.rolePresets,
            },
      );
    });
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  const retry = () => {
    setCatalog(LOADING_CATALOG);
    setReloadToken((token) => token + 1);
  };

  const presetByKey = React.useMemo(
    () => new Map(catalog.presets.map((preset) => [preset.key, preset])),
    [catalog.presets],
  );
  const entries = getPermissionEntries() as PermissionEntry[];
  const sourcePreset = source.kind === "preset" ? presetByKey.get(source.key) ?? null : null;
  const sourcePresetPermissions = sourcePreset ? presetPermissions(sourcePreset, catalog.permissions) : [];
  const locked = isPermissionEditingLocked(source);
  const summary = capabilitySummary(catalog.features, permMap);
  const blocker = saveBlocker(name, entries.length);
  const presetsAvailable = catalog.status === "ready" && catalog.presets.length > 0;
  const galleryVisible = stage === "gallery" && (catalog.status === "loading" || presetsAvailable);
  const presetLabel = (preset: RolePreset | null, key?: string) =>
    preset ? copy.name(preset.key, preset.name) : key ? copy.name(key) : "";

  const applyChange = (change: PendingChange) => {
    setNameError("");
    setFormError("");
    if (change.kind === "link") {
      resetPermMap(presetPermissions(change.preset, catalog.permissions));
      setSource({ kind: "preset", key: change.preset.key, linked: true });
      return;
    }
    const preset = change.kind === "preset" ? change.preset : null;
    resetPermMap(preset ? presetPermissions(preset, catalog.permissions) : []);
    setSource(preset ? sourceForChosenPreset(preset.key, role) : { kind: "blank" });
    if (!editing) {
      const nextName = preset ? copy.name(preset.key, preset.name) : "";
      const nextDescription = preset ? copy.description(preset.key, preset.description) : "";
      setName((current) => autofillValue(current, nameSuggestion, nextName));
      setDescription((current) => autofillValue(current, descriptionSuggestion, nextDescription));
      setNameSuggestion(nextName);
      setDescriptionSuggestion(nextDescription);
    }
    setStage("form");
  };

  const requestChange = (change: PendingChange) => {
    const target = change.kind === "blank" ? [] : presetPermissions(change.preset, catalog.permissions);
    if (shouldConfirmReplace(entries, sourcePresetPermissions, target)) {
      setPending(change);
      return;
    }
    applyChange(change);
  };

  const choose = (preset: RolePreset | null) =>
    requestChange(preset ? { kind: "preset", preset } : { kind: "blank" });

  const chooseCopy = () => {
    if (source.kind === "preset") setSource({ ...source, linked: false });
  };

  const chooseLink = () => {
    if (sourcePreset) requestChange({ kind: "link", preset: sourcePreset });
  };

  const restorePreset = () => {
    if (sourcePreset) resetPermMap(sourcePresetPermissions);
  };

  const save = async () => {
    if (savingRef.current || blocker) return;
    savingRef.current = true;
    setSaving(true);
    setNameError("");
    setFormError("");
    const draft = { name, description, permissions: entries, source };
    const result = role
      ? await updateCustomRole(wsId, role.id, buildUpdatePayload(draft, role))
      : await createCustomRole(wsId, buildCreatePayload(draft));
    savingRef.current = false;
    setSaving(false);
    if (result.error) {
      const failure = roleSaveError(result.code, result.error);
      const message = "messageKey" in failure ? t(failure.messageKey) : failure.message;
      if (failure.field === "name") setNameError(message);
      else setFormError(message);
      return;
    }
    await onSaved(result.role);
  };

  const selectedGalleryKey = editing ? null : source.kind === "preset" ? source.key : stage === "form" ? BLANK_START : null;
  const pendingTarget =
    pending && pending.kind !== "blank" ? presetLabel(pending.preset) : "";
  const headerPresetKey = source.kind === "preset" ? source.key : role?.presetKey;
  const blockerId = `${formId}-blocker`;

  return (
    <div className="space-y-4">
      <RoleBuilderHeader
        compact={compact}
        presetKey={headerPresetKey}
        title={editing ? tSettings("customRoles.editRole") : tSettings("customRoles.createRole")}
        subtitle={tSettings("customRoles.description")}
        closeLabel={t("close")}
        onClose={onCancel}
      />

      {catalog.status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
          <X className="h-4 w-4 flex-shrink-0 text-destructive-ink" weight="bold" aria-hidden />
          <p className="min-w-0 flex-1 text-xs text-foreground">{t("loadFailed")}</p>
          <ElevatedButton onClick={retry} variant="secondary" size="sm" title={t("retry")} />
        </div>
      ) : galleryVisible ? (
        <section className="space-y-3" aria-labelledby={`${formId}-gallery`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                id={`${formId}-gallery`}
                className={cn(
                  "font-semibold text-foreground",
                  compact ? "text-sm" : "font-display text-base tracking-[-0.01em]",
                )}
              >
                {t("galleryTitle")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("galleryDescription")}</p>
            </div>
            {editing && (
              <ElevatedButton
                onClick={() => setStage("form")}
                variant="ghost"
                size="sm"
                title={t("backToForm")}
                className="max-w-full whitespace-normal text-left"
                icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
                iconVisible
              />
            )}
          </div>
          <RolePresetGallery
            presets={catalog.presets}
            availablePermissions={catalog.permissions}
            loading={catalog.status === "loading"}
            selectedKey={selectedGalleryKey}
            compact={compact}
            onSelect={choose}
          />
          {!editing && (
            <div className="flex justify-start pt-1">
              <ElevatedButton onClick={onCancel} variant="outline-subtle" title={t("cancel")} />
            </div>
          )}
        </section>
      ) : (
        <ElevatedContainer className={cn("space-y-5", compact ? "!p-4" : "!p-5")}>
          {catalog.status === "ready" && !presetsAvailable && !editing && (
            <div className="flex items-start gap-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
              <p className="text-xs text-muted-foreground">{t("presetsUnavailable")}</p>
            </div>
          )}

          {presetsAvailable && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <RoleTile presetKey={source.kind === "preset" ? source.key : null} size="sm" />
                <span className="min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                  {source.kind === "preset" ? presetLabel(sourcePreset, source.key) : t("blankTitle")}
                </span>
              </div>
              <ElevatedButton
                onClick={() => setStage("gallery")}
                variant="ghost"
                size="sm"
                title={editing ? t("applyPreset") : t("changeStart")}
                className="max-w-full whitespace-normal text-left"
                icon={<Stack className="h-4 w-4" weight="bold" />}
                iconVisible
              />
            </div>
          )}

          <div className="space-y-3">
            <ElevatedInput
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
              label={tSettings("customRoles.roleName")}
              variant="outline"
              controlSize="sm"
              className="w-full"
              error={nameError || undefined}
              maxLength={120}
              autoFocus={editing || !presetsAvailable}
            />
            <ElevatedInput
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              label={tSettings("customRoles.roleDescription")}
              variant="outline"
              controlSize="sm"
              className="w-full"
              maxLength={500}
            />
          </div>

          {source.kind === "preset" && (
            <LinkChoice
              linked={source.linked}
              canLink={Boolean(sourcePreset) && canLinkPreset(source.key, role)}
              compact={compact}
              onLink={chooseLink}
              onCopy={chooseCopy}
            />
          )}

          <section className="space-y-3" aria-labelledby={`${formId}-summary`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h4 id={`${formId}-summary`} className="text-sm font-semibold text-foreground">
                {t("summaryTitle")}
              </h4>
              <PresetStatus
                source={source}
                sourcePreset={sourcePreset}
                entries={entries}
                sourcePresetPermissions={sourcePresetPermissions}
                presets={catalog.presets}
                availablePermissions={catalog.permissions}
                presetLabel={presetLabel}
                onRestore={restorePreset}
              />
            </div>
            {catalog.status === "loading" ? (
              <div className="flex h-16 items-center justify-center">
                <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" weight="bold" />
              </div>
            ) : summary.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("summaryEmpty")}</p>
            ) : (
              <div className={cn("grid gap-x-6 gap-y-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
                {summary.map((group) => (
                  <div key={group.featureKey} className="min-w-0 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground [overflow-wrap:anywhere]">{group.featureName}</p>
                    <ul className="space-y-1">
                      {group.capabilities.map((capability) => (
                        <li key={capability.key} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-healthy-ink" weight="bold" aria-hidden />
                          <span className="min-w-0 [overflow-wrap:anywhere]">{capability.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <button
              type="button"
              aria-expanded={showEditor}
              aria-controls={`${formId}-editor`}
              onClick={() => setShowEditor((open) => !open)}
              className="flex items-center gap-1.5 rounded-[--radius] text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showEditor ? (
                <CaretDown className="h-4 w-4" weight="bold" aria-hidden />
              ) : (
                <CaretRight className="h-4 w-4" weight="bold" aria-hidden />
              )}
              {locked ? t("viewPermissions") : t("adjustPermissions")}
              <span className="readout text-xs font-normal text-muted-foreground">
                ({t("permissionCount", { count: entries.length })})
              </span>
            </button>
            {showEditor && (
              <div id={`${formId}-editor`} className="space-y-3">
                {locked && source.kind === "preset" && (
                  <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
                    <p className="min-w-0 flex-1 text-xs text-foreground">
                      {t("linkedNotice", { preset: presetLabel(sourcePreset, source.key) })}
                    </p>
                    <ElevatedButton
                      onClick={chooseCopy}
                      variant="secondary"
                      size="sm"
                      title={t("unlinkToEdit")}
                      className="max-w-full whitespace-normal text-left"
                      icon={<LinkBreak className="h-4 w-4" weight="bold" />}
                      iconVisible
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{tScope("adminRoleCaption")}</p>
                {catalog.status === "loading" ? (
                  <div className="flex h-20 items-center justify-center">
                    <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" weight="bold" />
                  </div>
                ) : (
                  <PermissionsEditor
                    availablePermissions={catalog.permissions}
                    permMap={permMap}
                    onToggle={togglePermission}
                    onToggleAll={toggleAllForResource}
                    disabled={locked}
                    t={(key: string) => tSettings(key)}
                    compact={compact}
                  />
                )}
              </div>
            )}
          </section>

          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
              <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive-ink" weight="bold" aria-hidden />
              <p className="text-xs text-destructive-ink">{formError}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <ElevatedButton onClick={onCancel} variant="outline-subtle" title={t("cancel")} disabled={saving} />
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {blocker && (
                <span id={blockerId} className="text-2xs text-muted-foreground">
                  {blocker === "name" ? t("nameHint") : t("zeroPermissionsHint")}
                </span>
              )}
              <ElevatedButton
                onClick={save}
                disabled={Boolean(blocker) || saving || catalog.status !== "ready"}
                aria-busy={saving}
                aria-describedby={blocker ? blockerId : undefined}
                variant="primary"
                title={saving ? tSettings("customRoles.saving") : tSettings("customRoles.save")}
                icon={
                  saving ? (
                    <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                  ) : (
                    <Check className="h-4 w-4" weight="bold" />
                  )
                }
                iconVisible
              />
            </div>
          </div>
        </ElevatedContainer>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        tone="default"
        title={t("confirmReplaceTitle")}
        description={
          pending?.kind === "blank"
            ? t("confirmBlankDescription")
            : t("confirmReplaceDescription", { preset: pendingTarget })
        }
        confirmLabel={t("confirmReplace")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (pending) applyChange(pending);
          setPending(null);
        }}
      />
    </div>
  );
}

function RoleBuilderHeader({
  compact,
  presetKey,
  title,
  subtitle,
  closeLabel,
  onClose,
}: {
  compact: boolean;
  presetKey?: string | null;
  title: string;
  subtitle: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <ElevatedContainer className={cn("relative overflow-hidden", compact ? "!p-3" : "!p-4")}>
      <DotMatrix
        tone="quiet"
        className="pointer-events-none absolute right-0 top-0 h-10 w-16 -scale-x-100 opacity-70"
      />
      <div className="relative flex items-center gap-3 pr-12">
        {!compact && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-[--radius] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" weight="bold" />
          </button>
        )}
        <RoleTile presetKey={presetKey} size={compact ? "md" : "lg"} />
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "font-semibold text-foreground [overflow-wrap:anywhere]",
              compact ? "text-sm" : "font-display text-lg tracking-[0.01em]",
            )}
          >
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {compact && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-[--radius] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" weight="bold" />
          </button>
        )}
      </div>
    </ElevatedContainer>
  );
}

function LinkChoice({
  linked,
  canLink,
  compact,
  onLink,
  onCopy,
}: {
  linked: boolean;
  canLink: boolean;
  compact: boolean;
  onLink: () => void;
  onCopy: () => void;
}) {
  const t = useTranslations("roleBuilder");
  const labelId = React.useId();
  const options = [
    { key: "link", selected: linked, disabled: !canLink, title: t("linkOption"), body: canLink ? t("linkOptionDescription") : t("linkUnavailable"), onSelect: onLink },
    { key: "copy", selected: !linked, disabled: false, title: t("copyOption"), body: t("copyOptionDescription"), onSelect: onCopy },
  ];
  return (
    <div className="space-y-2">
      <p id={labelId} className="legend">{t("linkChoiceLabel")}</p>
      <div role="radiogroup" aria-labelledby={labelId} className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={option.selected}
            disabled={option.disabled}
            onClick={() => {
              if (!option.selected) option.onSelect();
            }}
            className={cn(
              "flex min-w-0 items-start gap-2.5 rounded-[--radius] border bg-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              option.selected ? "border-primary" : "border-border hover:border-control-edge",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
                option.selected ? "border-primary bg-primary text-primary-foreground" : "border-control-edge",
              )}
            >
              {option.selected && <Check className="h-2.5 w-2.5" weight="bold" />}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-semibold text-foreground">{option.title}</span>
              <span className="block text-xs text-muted-foreground">{option.body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PresetStatus({
  source,
  sourcePreset,
  entries,
  sourcePresetPermissions,
  presets,
  availablePermissions,
  presetLabel,
  onRestore,
}: {
  source: RoleSource;
  sourcePreset: RolePreset | null;
  entries: PermissionEntry[];
  sourcePresetPermissions: PermissionEntry[];
  presets: RolePreset[];
  availablePermissions: AvailablePermission[];
  presetLabel: (preset: RolePreset | null, key?: string) => string;
  onRestore: () => void;
}) {
  const t = useTranslations("roleBuilder");
  if (source.kind === "preset" && source.linked) {
    return (
      <span className="text-2xs text-muted-foreground">
        {t("linkedTo", { preset: presetLabel(sourcePreset, source.key) })}
      </span>
    );
  }
  if (sourcePreset) {
    const diff = permissionDiff(entries, sourcePresetPermissions);
    if (diff.total > 0) {
      return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
          <span>
            {t("basedOn", { preset: presetLabel(sourcePreset) })} · <span className="readout">{t("changes", { count: diff.total })}</span>
          </span>
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex items-center gap-1 rounded-[--radius] font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowCounterClockwise className="h-3 w-3" weight="bold" aria-hidden />
            {t("restorePreset")}
          </button>
        </span>
      );
    }
  }
  const match = matchingPreset(entries, presets, availablePermissions);
  if (!match) return null;
  return (
    <span className="text-2xs text-muted-foreground">
      {t("matchesPreset", { preset: presetLabel(match) })}
    </span>
  );
}
