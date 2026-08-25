"use client";

import { CATEGORY_STYLES, ICON_MAP } from "./workflow-node";
import { MagnifyingGlass, X } from "@/components/icons";
import type { NodeCategory, NodeDefinition } from "@/lib/workflows/types";
import { useEffect, useRef, useState } from "react";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: NodeCategory[] = [
  "trigger",
  "ai",
  "messaging",
  "action",
  "logic",
  "condition",
  "wait",
  "end",
];

const CATEGORY_LABEL: Record<string, string> = {
  trigger: "Gatilhos",
  ai: "Inteligência Artificial",
  messaging: "Mensagens",
  action: "Ações",
  logic: "Lógica",
  condition: "Condições",
  wait: "Espera",
  end: "Fim",
};

interface ContextMenuProps {
  x: number;
  y: number;
  definitions: NodeDefinition[];
  onSelect: (def: NodeDefinition) => void;
  onClose: () => void;
}

export function CanvasContextMenu({
  x,
  y,
  definitions,
  onSelect,
  onClose,
}: ContextMenuProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as HTMLElement)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const q = search.toLowerCase().trim();
  const filtered = definitions.filter(
    (d) =>
      d.category !== "visual" &&
      (q === "" ||
        d.label.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false) ||
        d.type.toLowerCase().includes(q)),
  );

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: filtered.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0);

  const style: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 9999,
    maxHeight: 420,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-72 bg-background border border-border rounded-[--radius] shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Search */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <ElevatedInput
            ref={inputRef}
            variant="search"
            controlSize="sm"
            icon={<MagnifyingGlass size={14} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nós..."
            inputClassName="text-sm pr-9"
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

      {/* Node list */}
      <div className="overflow-y-auto flex-1 p-1.5">
        {grouped.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum nó encontrado
          </p>
        )}
        {grouped.map(({ category, items }) => {
          const styles = CATEGORY_STYLES[category];
          return (
            <div key={category} className="mb-1.5">
              <p className="text-2xs font-semibold px-2 py-1 text-muted-foreground">
                {CATEGORY_LABEL[category]}
              </p>
              {items.map((def) => {
                const IconComp = ICON_MAP[def.icon];
                return (
                  <button
                    key={def.type}
                    onClick={() => onSelect(def)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                      "hover:bg-muted transition-colors cursor-pointer",
                    )}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: styles.color, color: styles.ink }}
                    >
                      {IconComp && <IconComp size={14} weight="fill" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {def.label}
                      </p>
                      {def.description && (
                        <p className="text-2xs text-muted-foreground truncate">
                          {def.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
