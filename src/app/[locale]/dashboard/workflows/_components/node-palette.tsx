"use client";

import { CATEGORY_STYLES, ICON_MAP } from "./workflow-node";
import { DotsSixVertical, MagnifyingGlass, X } from "@/components/icons";
import type { NodeCategory, NodeDefinition } from "@/lib/workflows/types";
import { useMemo, useState } from "react";

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

const CATEGORY_LABEL: Record<NodeCategory, string> = {
  trigger: "Gatilhos",
  ai: "Inteligência Artificial",
  messaging: "Mensagens",
  action: "Ações",
  logic: "Lógica",
  condition: "Condições",
  wait: "Espera",
  end: "Fim",
  visual: "Visual",
};

interface NodePaletteProps {
  definitions: NodeDefinition[];
}

export function NodePalette({ definitions }: NodePaletteProps) {
  const t = useTranslations("workflowsPage");

  const allDefinitions = useMemo(() => {
    const groupDef: NodeDefinition = {
      type: "group",
      category: "visual",
      label: "Grupo",
      description: "Área visual de agrupamento, sem lógica de execução",
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
  }, [definitions]);

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
    <div className="w-64 border-r border-border bg-card overflow-y-auto flex-shrink-0">
      <div className="p-3 border-b border-border space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">
          {t("palette.title")}
        </h3>
        <div className="relative">
          <ElevatedInput
            variant="search"
            controlSize="sm"
            icon={<MagnifyingGlass size={14} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nós..."
            inputClassName="text-xs pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="p-2 space-y-4">
        {grouped.map(({ category, items }) => {
          const styles = CATEGORY_STYLES[category];
          return (
            <div key={category}>
              <p
                className={cn(
                  "text-2xs font-semibold px-1 mb-1.5 text-muted-black",
                )}
              >
                {CATEGORY_LABEL[category]}
              </p>
              <div className="space-y-2">
                {items.map((def) => {
                  const IconComp = ICON_MAP[def.icon];
                  return (
                    <div
                      key={def.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, def)}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-[--radius] border border-dashed p-3",
                        "cursor-grab transition-all",
                        "border-border hover:border-border hover:bg-muted hover:shadow-sm active:cursor-grabbing",
                      )}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
                        style={{ backgroundColor: styles.color }}
                      >
                        {IconComp && <IconComp size={18} weight="fill" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {def.label}
                        </p>
                        {def.description && (
                          <p className="text-2xs leading-tight text-muted-foreground line-clamp-2 mt-0.5">
                            {def.description}
                          </p>
                        )}
                      </div>
                      {/* Grab handle overlay */}
                      <div className="absolute inset-y-0 right-1 flex items-center opacity-0 group-hover:opacity-60 transition-opacity">
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
  );
}
