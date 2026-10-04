"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { DotsThree, Image as ImageGlyph, Megaphone, Stack, Warning, type Icon } from "@/components/icons";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EditorStatus } from "@/lib/advertising/editor-status";
import type { AdLevel } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

export type EditorTab = "edit" | "analyze";

export type TreeLevel = "campaign" | "adSet" | "ad";

export const TREE_LEVEL: Record<AdLevel, TreeLevel> = { campaign: "campaign", adset: "adSet", ad: "ad" };

const LEVEL_ICONS: Record<TreeLevel, Icon> = {
  campaign: Megaphone,
  adSet: Stack,
  ad: ImageGlyph,
};

const LEVEL_DEPTH: Record<TreeLevel, string> = {
  campaign: "pl-2",
  adSet: "pl-5",
  ad: "pl-8",
};

export interface TreeAction {
  key: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}

export interface TreeEntry {
  key: string;
  level: TreeLevel;
  label: string;
  selected: boolean;
  flagged?: boolean;
  onSelect?: () => void;
  actions?: TreeAction[];
}

function TreeMenu({ label, actions }: { label: string; actions: TreeAction[] }) {
  const t = useTranslations("adsEditor.tree");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("menu", { name: label })}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <DotsThree className="h-4 w-4" weight="bold" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            disabled={action.disabled}
            onSelect={action.onSelect}
            className={action.destructive ? "text-destructive-ink focus:text-destructive-ink" : undefined}
          >
            <span className="mr-2 inline-flex">{action.icon}</span>
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EditorTree({ entries, label }: { entries: TreeEntry[]; label: string }) {
  const t = useTranslations("adsEditor.tree");
  return (
    <nav aria-label={label} className="rounded-[--radius] border border-border bg-card p-2 shadow-sm">
      <ul className="space-y-0.5">
        {entries.map((entry) => {
          const LevelIcon = LEVEL_ICONS[entry.level];
          const content = (
            <>
              <LevelIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className={cn("truncate", entry.selected ? "font-semibold text-foreground" : "text-foreground")}>{entry.label}</span>
              {entry.flagged ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-label={t("hasIssues")} /> : null}
            </>
          );
          return (
            <li
              key={entry.key}
              className={cn(
                "flex items-center gap-1 rounded-[--radius] pr-1 transition-colors",
                LEVEL_DEPTH[entry.level],
                entry.selected ? "bg-muted" : "hover:bg-muted",
              )}
            >
              {entry.onSelect ? (
                <button
                  type="button"
                  onClick={entry.onSelect}
                  aria-current={entry.selected ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
                >
                  {content}
                </button>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm">{content}</span>
              )}
              {entry.actions && entry.actions.length > 0 ? <TreeMenu label={entry.label} actions={entry.actions} /> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface CrumbEntry {
  key: string;
  label: string;
  current: boolean;
  onSelect?: () => void;
}

export function EditorBreadcrumb({ crumbs }: { crumbs: CrumbEntry[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.key}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.onSelect ? (
                <button
                  type="button"
                  onClick={crumb.onSelect}
                  aria-current={crumb.current ? "page" : undefined}
                  className={cn("max-w-[14rem] truncate transition-colors hover:text-foreground", crumb.current && "font-semibold text-foreground")}
                >
                  {crumb.label}
                </button>
              ) : (
                <span aria-current={crumb.current ? "page" : undefined} className={cn("max-w-[14rem] truncate", crumb.current && "font-semibold text-foreground")}>
                  {crumb.label}
                </span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function EditorFailure({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-destructive-ink">
      <Warning className="h-4 w-4" aria-hidden />
      {message}
    </p>
  );
}

const STATUS_DOT: Record<EditorStatus, string> = {
  draft: "bg-muted-foreground",
  publishing: "bg-primary",
  failed: "bg-destructive",
};

export function EditorStatusLine({ status, detail }: { status: EditorStatus | null; detail?: ReactNode }) {
  const t = useTranslations("adsEditor.status");
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
      {status ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden />
          {t(status)}
        </span>
      ) : null}
      {detail}
    </p>
  );
}

export function EditorShell({
  breadcrumb,
  status,
  tab,
  onTab,
  notice,
  tree,
  aside,
  footer,
  children,
}: {
  breadcrumb: ReactNode;
  status: ReactNode;
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
  notice?: ReactNode;
  tree: ReactNode;
  aside?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("adsEditor.tabs");
  return (
    <div className="w-full space-y-4">
      <header className="space-y-3">
        {breadcrumb}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Tabs value={tab} onValueChange={(value) => onTab(value as EditorTab)}>
            <TabsList>
              <TabsTrigger value="edit">{t("edit")}</TabsTrigger>
              <TabsTrigger value="analyze">{t("analyze")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {status}
        </div>
        {notice}
      </header>
      <div className={cn("grid gap-4", aside ? "lg:grid-cols-[15rem_minmax(0,1fr)_22rem]" : "lg:grid-cols-[15rem_minmax(0,1fr)]")}>
        <aside className="lg:sticky lg:top-16 lg:self-start">{tree}</aside>
        <main className="min-w-0 space-y-4">{children}</main>
        {aside ? <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100dvh-10rem)] lg:self-start lg:overflow-y-auto">{aside}</aside> : null}
      </div>
      <footer className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background px-4 py-3 sm:mx-0 sm:px-0">{footer}</footer>
    </div>
  );
}
