"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Copy, DotsThree, DownloadSimple, Lightning, PaperPlaneTilt, PencilSimple, Plus, TestTube, Trash } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { Link } from "@/i18n/routing";
import { isCreativeField, type BulkMode } from "@/lib/advertising/manager-bulk";
import type { ActionState } from "@/lib/advertising/manager-toolbar";
import type { AdBulkField } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { TOOLBAR_CONTROL } from "../report-controls";
import type { BlockerText } from "./use-blocker-text";

export interface ToolbarStates {
  create: ActionState;
  publish: ActionState;
  duplicate: ActionState;
  edit: ActionState;
  bulkEdit: ActionState;
  activate: ActionState;
  pause: ActionState;
  remove: ActionState;
  abTest: ActionState | null;
}

export interface ToolbarHandlers {
  onCreate: () => void;
  onPublish: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onBulkEdit: (field: AdBulkField, mode: BulkMode) => void;
  onSwitch: (on: boolean) => void;
  onDelete: () => void;
  onAbTest: () => void;
  onExport: () => void;
}

function Guarded({ state, blockerText, children }: { state: ActionState; blockerText: BlockerText; children: ReactNode }) {
  const reason = blockerText(state);
  return (
    <TooltipWrapper content={reason ?? ""} enabled={!!reason}>
      {children}
    </TooltipWrapper>
  );
}

function ToolButton({
  state,
  blockerText,
  icon,
  label,
  onClick,
  primary,
  iconOnly,
}: {
  state: ActionState;
  blockerText: BlockerText;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <Guarded state={state} blockerText={blockerText}>
      <button
        type="button"
        disabled={!state.enabled}
        onClick={onClick}
        aria-label={label}
        title={iconOnly ? label : undefined}
        className={cn(
          TOOLBAR_CONTROL,
          primary && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          iconOnly && "w-8 justify-center px-0",
        )}
      >
        {icon}
        {iconOnly ? null : <span className={primary ? undefined : "max-sm:sr-only"}>{label}</span>}
      </button>
    </Guarded>
  );
}

export function SelectionToolbar({
  states,
  handlers,
  hasSelection,
  showPublish,
  bulkFields,
  rulesHref,
  exportDisabled,
  blockerText,
  aside,
}: {
  states: ToolbarStates;
  handlers: ToolbarHandlers;
  hasSelection: boolean;
  showPublish: boolean;
  bulkFields: AdBulkField[];
  rulesHref: string;
  exportDisabled: boolean;
  blockerText: BlockerText;
  aside: ReactNode;
}) {
  const t = useTranslations("adsManager.toolbar");
  const editMenuEnabled = states.edit.enabled || states.bulkEdit.enabled || states.activate.enabled || states.pause.enabled;
  const generalFields = bulkFields.filter((field) => !isCreativeField(field));
  const creativeFields = bulkFields.filter(isCreativeField);
  const bulkReason = blockerText(states.bulkEdit);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <ToolButton
        state={states.create}
        blockerText={blockerText}
        icon={<Plus className="h-4 w-4" weight="bold" aria-hidden />}
        label={t("create")}
        onClick={handlers.onCreate}
        primary
      />
      {showPublish ? (
        <ToolButton
          state={states.publish}
          blockerText={blockerText}
          icon={<PaperPlaneTilt className="h-4 w-4" aria-hidden />}
          label={t("publish")}
          onClick={handlers.onPublish}
        />
      ) : null}
      <ToolButton
        state={states.duplicate}
        blockerText={blockerText}
        icon={<Copy className="h-4 w-4" aria-hidden />}
        label={t("duplicate")}
        onClick={handlers.onDuplicate}
      />
      <div className="inline-flex">
        <ToolButton
          state={states.edit}
          blockerText={blockerText}
          icon={<PencilSimple className="h-4 w-4" aria-hidden />}
          label={t("edit")}
          onClick={handlers.onEdit}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={!editMenuEnabled} aria-label={t("editMenu")} className={cn(TOOLBAR_CONTROL, "ml-px w-8 justify-center px-0")}>
              <CaretDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{t("general")}</DropdownMenuLabel>
            <DropdownMenuItem disabled={!states.activate.enabled} onSelect={() => handlers.onSwitch(true)}>
              <span className="flex flex-col">
                {t("activate")}
                {blockerText(states.activate) ? <span className="text-2xs text-muted-foreground">{blockerText(states.activate)}</span> : null}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!states.pause.enabled} onSelect={() => handlers.onSwitch(false)}>
              <span className="flex flex-col">
                {t("deactivate")}
                {blockerText(states.pause) ? <span className="text-2xs text-muted-foreground">{blockerText(states.pause)}</span> : null}
              </span>
            </DropdownMenuItem>
            {generalFields.map((field) => (
              <DropdownMenuItem key={field} disabled={!states.bulkEdit.enabled} onSelect={() => handlers.onBulkEdit(field, "set")}>
                {t(`fields.${field}`)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem disabled={!states.bulkEdit.enabled} onSelect={() => handlers.onBulkEdit("name", "replace")}>
              {t("findReplace")}
            </DropdownMenuItem>
            {creativeFields.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("creative")}</DropdownMenuLabel>
                {creativeFields.map((field) => (
                  <DropdownMenuItem key={field} disabled={!states.bulkEdit.enabled} onSelect={() => handlers.onBulkEdit(field, "set")}>
                    {t(`fields.${field}`)}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            {bulkReason ? <p className="px-2 py-1.5 text-2xs text-muted-foreground">{bulkReason}</p> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasSelection ? (
        <ToolButton
          state={states.remove}
          blockerText={blockerText}
          icon={<Trash className="h-4 w-4" aria-hidden />}
          label={t("delete")}
          onClick={handlers.onDelete}
          iconOnly
        />
      ) : null}
      {states.abTest ? (
        <ToolButton
          state={states.abTest}
          blockerText={blockerText}
          icon={<TestTube className="h-4 w-4" aria-hidden />}
          label={t("abTest")}
          onClick={handlers.onAbTest}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOLBAR_CONTROL} aria-label={t("more")}>
            <DotsThree className="h-4 w-4" weight="bold" aria-hidden />
            <span className="max-sm:sr-only">{t("more")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem asChild>
            <Link href={rulesHref}>
              <Lightning className="mr-2 h-4 w-4" aria-hidden />
              {t("rules")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={exportDisabled} onSelect={handlers.onExport}>
            <DownloadSimple className="mr-2 h-4 w-4" aria-hidden />
            {t("export")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{aside}</div>
    </div>
  );
}
