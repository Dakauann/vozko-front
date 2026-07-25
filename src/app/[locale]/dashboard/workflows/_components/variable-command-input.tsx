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
} from "@phosphor-icons/react";
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
      // did not steal focus) must close it — and stick.
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

    // Only auto-open when the user hasn't just dismissed this same trigger —
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
                  "bg-muted/80 text-muted-foreground hover:bg-primary/10 hover:text-primary",
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
          className="w-[420px] p-0 shadow-2xl border-border/50"
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
                /* number/email inputs disallow setSelectionRange — safe to ignore */
              }
            });
          }}
        >
          <Command shouldFilter={false} className="rounded-lg">
            {/* Header */}
            <div className="px-3 py-2.5 border-b bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                  <BracketsCurly
                    size={14}
                    className="text-primary"
                    weight="bold"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Inserir Variável
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
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
                    className="text-muted-foreground/50"
                  />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma variável encontrada
                  </p>
                  <p className="text-xs text-muted-foreground/70">
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
                            category === "last" && "text-emerald-500",
                            category === "custom" && "text-violet-500",
                            category === "system" && "text-blue-500",
                            category === "node" && "text-amber-500",
                          )}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {categoryLabel}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60 ml-auto">
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
                          className="flex items-start gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 data-[selected=true]:bg-primary/10"
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              category === "last" && "bg-emerald-500/10",
                              category === "custom" && "bg-violet-500/10",
                              category === "system" && "bg-blue-500/10",
                              category === "node" && "bg-amber-500/10",
                            )}
                          >
                            <VarIcon
                              size={14}
                              weight="duotone"
                              className={cn(
                                category === "last" && "text-emerald-600",
                                category === "custom" && "text-violet-600",
                                category === "system" && "text-blue-600",
                                category === "node" && "text-amber-600",
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">
                                {v.description}
                              </span>
                              {category === "last" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-medium shrink-0">
                                  Recomendado
                                </span>
                              )}
                            </div>
                            <code className="text-[10px] text-muted-foreground/70 font-mono mt-0.5 block">
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
            <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[9px] font-mono">
                    ↑↓
                  </kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[9px] font-mono">
                    Enter
                  </kbd>
                  selecionar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[9px] font-mono">
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
