"use client";

import { CATEGORY_STYLES, ICON_MAP } from "./workflow-node";
import {
  CaretLeft,
  CaretRight,
  DotsSixVertical,
  MagnifyingGlass,
  X,
} from "@/components/icons";
import type { NodeCategory, NodeDefinition } from "@/lib/workflows/types";
import { useEffect, useMemo, useState } from "react";

import type { DragEvent } from "react";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const CATEGORY_ORDER: NodeCategory[] = [
  "trigger",
  "ai",
  "messaging",
  "action",
  "logic",
  "condition",
  "wait",
  "end",
  "visual",
];

// The canvas is the work; the palette is a drawer onto it. Operators who know
// the node types want the width back, and the ones building their first flow
// want the drawer open — so the choice is remembered rather than reset on every
// visit. Same reasoning as the agent create/edit chooser.
const COLLAPSE_KEY = "workflow-palette-collapsed";

interface NodePaletteProps {
  definitions: NodeDefinition[];
}

export function NodePalette({ definitions }: NodePaletteProps) {
  const t = useTranslations("workflowsPage");

  const [collapsed, setCollapsed] = useState(false);
  // Read after mount: localStorage is not available during SSR, and seeding
  // state from it directly would hydrate-mismatch.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Storage unavailable: the palette simply opens expanded.
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Ignored: the toggle still works for this session.
      }
      return next;
    });
  };

  const allDefinitions = useMemo(() => {
    const groupDef: NodeDefinition = {
      type: "group",
      category: "visual",
      label: t("palette.group.label"),
      description: t("palette.group.description"),
      icon: "Square",
      defaultConfig: {
        border_style: "dashed",
        color: "gray",
        border_width: 2,
      },
      configSchema: null,
      resizable: true,
    };
    return [...definitions, groupDef];
  }, [definitions, t]);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allDefinitions;
    return allDefinitions.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false) ||
        d.type.toLowerCase().includes(q),
    );
  }, [allDefinitions, search]);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        category: cat,
        items: filtered.filter((n) => n.category === cat),
      })).filter((g) => g.items.length > 0),
    [filtered],
  );

  // Every category present, ignoring the search filter: the collapsed rail is
  // navigation, and a rail whose rungs disappear as you type is not navigation.
  const railCategories = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        category: cat,
        icon: allDefinitions.find((d) => d.category === cat)?.icon,
      })).filter((c) => c.icon),
    [allDefinitions],
  );

  const onDragStart = (e: DragEvent, def: NodeDefinition) => {
    e.dataTransfer.setData("application/reactflow-type", def.type);
    e.dataTransfer.setData(
      "application/reactflow-config",
      JSON.stringify(def.defaultConfig ?? {}),
    );
    e.dataTransfer.setData("application/reactflow-label", def.label);
    e.dataTransfer.setData("application/reactflow-icon", def.icon);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={cn(
        "relative z-40 flex h-full flex-shrink-0 flex-col border-r border-border bg-card shadow-xl",
        "transition-[width] duration-DEFAULT motion-reduce:transition-none",
        collapsed ? "w-12" : "w-64",
      )}
    >
      {/* Header: the toggle lives here in both states, so the control does not
          move when the drawer opens or closes. */}
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border p-3",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed && (
          <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-muted-foreground">
            {t("palette.title")}
          </h3>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("palette.expand") : t("palette.collapse")}
          title={collapsed ? t("palette.expand") : t("palette.collapse")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] border border-control-edge bg-card text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <CaretRight size={13} weight="bold" />
          ) : (
            <CaretLeft size={13} weight="bold" />
          )}
        </button>
      </div>

      {collapsed ? (
        // Collapsed: a rail of category plates. It reclaims ~208px of canvas and
        // still says what the drawer holds — clicking a rung opens it, so the
        // palette stays one click away instead of one click plus a hunt.
        <nav
          aria-label={t("palette.title")}
          className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto py-2"
        >
          {railCategories.map(({ category, icon }) => {
            const IconComp = icon ? ICON_MAP[icon] : null;
            const styles = CATEGORY_STYLES[category];
            return (
              <button
                key={category}
                type="button"
                onClick={toggle}
                title={t(`palette.${category}`)}
                aria-label={t(`palette.${category}`)}
                className="flex h-8 w-8 items-center justify-center rounded-[--radius] shadow-sm transition-transform duration-DEFAULT hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
                style={{ backgroundColor: styles.color, color: styles.ink }}
              >
                {IconComp && <IconComp size={15} weight="fill" />}
              </button>
            );
          })}
        </nav>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border p-3">
            <div className="relative">
              <ElevatedInput
                variant="search"
                controlSize="sm"
                icon={<MagnifyingGlass size={14} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("palette.searchPlaceholder")}
                inputClassName="text-xs pr-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={t("palette.clearSearch")}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
            {grouped.map(({ category, items }) => {
              const styles = CATEGORY_STYLES[category];
              return (
                <div key={category}>
                  {/* The category's own plate colour as a 2px bar, so a group
                      head is findable while scrolling without spending a second
                      saturated block on every heading. `text-muted-black` used
                      to sit here and is not a token — it painted nothing. */}
                  <p className="mb-1.5 flex items-center gap-1.5 px-1 text-2xs font-semibold text-muted-foreground">
                    <span
                      aria-hidden
                      className="h-2.5 w-[2px] rounded-full"
                      style={{ backgroundColor: styles.color }}
                    />
                    {t(`palette.${category}`)}
                  </p>
                  <div className="space-y-2">
                    {items.map((def) => {
                      const IconComp = ICON_MAP[def.icon];
                      return (
                        <div
                          key={def.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, def)}
                          role="button"
                          tabIndex={0}
                          title={def.label}
                          className={cn(
                            "group relative flex cursor-grab items-start gap-3 rounded-[--radius] border border-dashed border-border p-3",
                            "transition-colors duration-DEFAULT active:cursor-grabbing",
                            // The old hover set `border-border` on top of
                            // `border-border` — a no-op that read as a dead
                            // control. The edge now actually moves, to the value
                            // that clears 3:1 on the ground it lands on.
                            "hover:border-control-edge hover:bg-muted",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
                            style={{
                              backgroundColor: styles.color,
                              color: styles.ink,
                            }}
                          >
                            {IconComp && <IconComp size={18} weight="fill" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {def.label}
                            </p>
                            {def.description && (
                              <p className="mt-0.5 line-clamp-2 text-2xs leading-tight text-muted-foreground">
                                {def.description}
                              </p>
                            )}
                          </div>
                          {/* Grab affordance */}
                          <div className="absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity duration-DEFAULT group-hover:opacity-60">
                            <DotsSixVertical
                              size={14}
                              weight="bold"
                              className="text-muted-foreground"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
