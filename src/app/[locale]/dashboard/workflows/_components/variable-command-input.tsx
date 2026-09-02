"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  BracketsCurly,
  MagnifyingGlass,
  Gear,
  ArrowBendUpLeft,
  TreeStructure,
  Tag,
} from "@/components/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { cn } from "@/lib/utils";


interface VarGroup {
  label: string;
  description?: string;
  vars: { template: string; description: string }[];
}

interface FlatVariable {
  template: string;
  key: string;
  description: string;
  groupLabel: string;
  category: "last" | "custom" | "system" | "node";
  priority: number;
}

interface VariableCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  controlSize?: "sm" | "default" | "lg";
  availableVars: VarGroup[];
  multiline?: boolean;
  className?: string;
}


function extractVariableKey(template: string): string {
  const inner = template.replace(/^\{\{/, "").replace(/\}\}$/, "");

  if (inner.includes(".")) {
    const parts = inner.split(".");
    return parts[parts.length - 1];
  }

  return inner;
}

function getVariableCategory(
  template: string,
  groupLabel: string,
): "last" | "custom" | "system" | "node" {
  if (template.includes("last.") || groupLabel.includes("(nó anterior)")) {
    return "last";
  }
  if (template.startsWith("{{var.")) {
    return "custom";
  }
  if (
    groupLabel.toLowerCase() === "sistema" ||
    template === "{{message}}" ||
    template.startsWith("{{sys.")
  ) {
    return "system";
  }
  if (template.includes("node.")) {
    return "node";
  }
  return "custom";
}

function getVariablePriority(
  category: "last" | "custom" | "system" | "node",
): number {
  switch (category) {
    case "last":
      return 1;
    case "custom":
      return 2;
    case "system":
      return 3;
    case "node":
      return 4;
    default:
      return 5;
  }
}

function getCategoryIcon(category: "last" | "custom" | "system" | "node") {
  switch (category) {
    case "last":
      return ArrowBendUpLeft;
    case "custom":
      return Tag;
    case "system":
      return Gear;
    case "node":
      return TreeStructure;
  }
}

function getCategoryLabel(
  category: "last" | "custom" | "system" | "node",
): string {
  switch (category) {
    case "last":
      return "Nó Anterior";
    case "custom":
      return "Variáveis Personalizadas";
    case "system":
      return "Sistema";
    case "node":
      return "Outros Nós";
  }
}

function flattenAndSortVariables(groups: VarGroup[]): FlatVariable[] {
  const flattened: FlatVariable[] = [];

  for (const group of groups) {
    for (const v of group.vars) {
      const category = getVariableCategory(v.template, group.label);
      flattened.push({
        template: v.template,
        key: extractVariableKey(v.template),
        description: v.description,
        groupLabel: group.label,
        category,
        priority: getVariablePriority(category),
      });
    }
  }

  return flattened.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.key.localeCompare(b.key);
  });
}

function groupByCategory(
  sorted: FlatVariable[],
): Map<"last" | "custom" | "system" | "node", FlatVariable[]> {
  const groups = new Map<
    "last" | "custom" | "system" | "node",
    FlatVariable[]
  >();

  for (const v of sorted) {
    const existing = groups.get(v.category) ?? [];
    existing.push(v);
    groups.set(v.category, existing);
  }

  return groups;
}


export function VariableCommandInput({
  value,
  onChange,
  placeholder,
  label,
  controlSize = "sm",
  availableVars,
  multiline = false,
  className,
}: VariableCommandInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);
  // When the user dismisses the popup (Esc / click-away) while the caret still
  // sits right after "{{", remember it so the auto-open effect below does not
  // instantly re-open it. Cleared once the caret moves off the "{{" trigger.
  const dismissedRef = useRef(false);

  const getInputElement = useCallback(() => {
    return multiline ? textareaRef.current : inputRef.current;
  }, [multiline]);

  const sortedVariables = useMemo(
    () => flattenAndSortVariables(availableVars),
    [availableVars],
  );

  const filteredVariables = useMemo(() => {
    if (!search.trim()) return sortedVariables;

    const query = search.toLowerCase().trim();
    return sortedVariables.filter(
      (v) =>
        v.key.toLowerCase().includes(query) ||
        v.template.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.groupLabel.toLowerCase().includes(query),
    );
  }, [sortedVariables, search]);

  const groupedVariables = useMemo(
    () => groupByCategory(filteredVariables),
    [filteredVariables],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
      cursorPositionRef.current =
        e.target.selectionStart ?? e.target.value.length;
    },
    [onChange],
  );

  const handleSelectVariable = useCallback(
    (template: string) => {
      const input = getInputElement();
      const safeValue = typeof value === "string" ? value : "";
      if (!input) {
        onChange(safeValue + template);
        setOpen(false);
        setSearch("");
        return;
      }

      const cursorPos = cursorPositionRef.current;
      const before = safeValue.slice(0, cursorPos);
      const after = safeValue.slice(cursorPos);
      const newValue = before + template + after;

      onChange(newValue);
      setOpen(false);
      setSearch("");

      requestAnimationFrame(() => {
        input.focus();
        const newCursorPos = cursorPos + template.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
        cursorPositionRef.current = newCursorPos;
      });
    },
    [value, onChange, getInputElement],
  );

  const handleCursorChange = useCallback(() => {
    const input = getInputElement();
    if (input) {
      cursorPositionRef.current =
        input.selectionStart ?? (typeof value === "string" ? value.length : 0);
    }
  }, [value, getInputElement]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === " ") {
        e.preventDefault();
        dismissedRef.current = false;
        setOpen(true);
        return;
      }
      // Esc typed while focus is still in the field (the popup auto-opened but
      // did not steal focus) must close it, and stick.
      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        dismissedRef.current = true;
        setOpen(false);
      }
    },
    [open],
  );

  useEffect(() => {
    const input = getInputElement();
    if (!input || typeof value !== "string") return;

    const cursorPos = cursorPositionRef.current;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Caret moved off the "{{" trigger: clear any prior dismissal so the next
    // freshly-typed "{{" can auto-open again.
    if (!textBeforeCursor.endsWith("{{")) {
      dismissedRef.current = false;
      return;
    }

    // Only auto-open when the user hasn't just dismissed this same trigger,
    // otherwise Esc/click-away is undone on the very next render.
    if (!open && !dismissedRef.current) {
      setOpen(true);
    }
  }, [value, open, getInputElement]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    // A close from Radix (Esc, click-away) must stick even while the caret is
    // still right after "{{".
    if (!next) dismissedRef.current = true;
  }, []);

  const hasVariables = availableVars.length > 0 && sortedVariables.length > 0;

  const categoryOrder: Array<"last" | "custom" | "system" | "node"> = [
    "last",
    "custom",
    "system",
    "node",
  ];

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <div className="relative">
          {multiline ? (
            <ElevatedTextarea
              ref={textareaRef}
              label={label}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              placeholder={placeholder}
              controlSize={controlSize}
              className="pr-10"
              rows={4}
            />
          ) : (
            <ElevatedInput
              ref={inputRef}
              label={label}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              placeholder={placeholder}
              controlSize={controlSize}
              className="pr-10"
            />
          )}
          {hasVariables && (
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-md transition-all",
                  "bg-muted text-muted-foreground hover:bg-muted hover:text-primary-ink",
                  multiline ? "top-1.5" : "top-1/2 -translate-y-1/2",
                )}
                title="Inserir variável (Ctrl+Espaço ou {{)"
              >
                <BracketsCurly size={14} weight="bold" />
              </button>
            </PopoverTrigger>
          )}
        </div>

        <PopoverContent
          align="start"
          side="bottom"
          // z-[200] matches ElevatedSelect's overlay layer, which is what any
          // portalled content needs to clear a modal.
          //
          // PopoverContent's base is z-50, and Radix portals it to <body> — so
          // it became a sibling of the node config panel, which is z-[70], and
          // lost. The picker opened *behind* the panel that triggered it. The
          // selects in the same panel never showed the bug because they already
          // sit at 200; this just stops the variable picker being the one
          // overlay that forgot.
          //
          // collisionPadding keeps it inside the viewport when the field it is
          // attached to is near the panel's bottom edge, instead of clipping.
          collisionPadding={12}
          className="z-[200] w-[420px] p-0 shadow-2xl border-border"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          onCloseAutoFocus={(e) => {
            // Radix would return focus to the little trigger button. Instead,
            // send focus back to the field the user was typing in and restore
            // the caret where they left off (Esc / click-away / after inserting).
            e.preventDefault();
            const input = getInputElement();
            if (!input) return;
            input.focus();
            const pos = cursorPositionRef.current;
            requestAnimationFrame(() => {
              try {
                input.setSelectionRange(pos, pos);
              } catch {
                /* number/email inputs disallow setSelectionRange, safe to ignore */
              }
            });
          }}
        >
          <Command shouldFilter={false} className="rounded-lg">
            {/* Header */}
            <div className="px-3 py-2.5 border-b">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                  <BracketsCurly
                    size={14}
                    className="text-primary-ink"
                    weight="bold"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Inserir Variável
                  </h4>
                  <p className="text-2xs text-muted-foreground">
                    Selecione uma variável para inserir no campo
                  </p>
                </div>
              </div>
              <ElevatedInput
                ref={searchInputRef}
                placeholder="Buscar por nome ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                controlSize="sm"
                icon={<MagnifyingGlass size={14} />}
              />
            </div>

            <CommandList className="max-h-[320px] overflow-y-auto">
              <CommandEmpty className="py-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <MagnifyingGlass
                    size={24}
                    className="text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma variável encontrada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tente buscar por outro termo
                  </p>
                </div>
              </CommandEmpty>

              {categoryOrder.map((category) => {
                const vars = groupedVariables.get(category);
                if (!vars || vars.length === 0) return null;

                const Icon = getCategoryIcon(category);
                const categoryLabel = getCategoryLabel(category);

                return (
                  <CommandGroup
                    key={category}
                    heading={
                      <div className="flex items-center gap-2 px-1 py-1">
                        <Icon
                          size={12}
                          weight="bold"
                          className={cn(
                            category === "last" && "text-healthy-ink",
                            category === "custom" && "text-chart-4",
                            category === "system" && "text-info-ink",
                            category === "node" && "text-warning-ink",
                          )}
                        />
                        <span className="text-2xs font-semibold text-muted-foreground">
                          {categoryLabel}
                        </span>
                        <span className="text-2xs text-muted-foreground ml-auto">
                          {vars.length}
                        </span>
                      </div>
                    }
                    className="pb-2"
                  >
                    {vars.map((v) => {
                      const VarIcon = getCategoryIcon(v.category);
                      return (
                        <CommandItem
                          key={v.template}
                          value={`${v.key} ${v.template} ${v.description}`}
                          onSelect={() => handleSelectVariable(v.template)}
                          // The selection ground is NOT overridden here.
                          //
                          // It used to be `data-[selected=true]:bg-muted`, which
                          // is invisible: --muted IS --popover in dark, so the
                          // highlight measured 1.00:1 against the very panel it
                          // was drawn on, and arrowing through the list moved
                          // nothing on screen. CommandItem's own base already
                          // carries --accent-hover, the ground the select items
                          // moved to for exactly this reason; letting it through
                          // is the whole fix.
                          className="mx-1 flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5"
                        >
                          {/*
                            The tile was `bg-muted` for all four categories —
                            the same invisible ground, and branching four ways to
                            reach one value. An outlined plate reads on the
                            popover AND on the selected row, where a filled one
                            would vanish into the highlight.
                          */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-strong">
                            <VarIcon
                              size={14}
                              weight="duotone"
                              className={cn(
                                category === "last" && "text-healthy-ink",
                                category === "custom" && "text-muted-foreground",
                                category === "system" && "text-muted-foreground",
                                category === "node" && "text-warning-ink",
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">
                                {v.description}
                              </span>
                              {category === "last" && (
                                <span className="text-2xs px-1.5 py-0.5 rounded-full bg-healthy text-healthy-foreground font-medium shrink-0">
                                  Recomendado
                                </span>
                              )}
                            </div>
                            <code className="text-2xs text-muted-foreground font-mono mt-0.5 block">
                              {v.template}
                            </code>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </CommandList>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t bg-muted flex items-center justify-between">
              <div className="flex items-center gap-3 text-2xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-2xs font-mono">
                    ↑↓
                  </kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-2xs font-mono">
                    Enter
                  </kbd>
                  selecionar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-2xs font-mono">
                    Esc
                  </kbd>
                  fechar
                </span>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type { VarGroup, VariableCommandInputProps };
