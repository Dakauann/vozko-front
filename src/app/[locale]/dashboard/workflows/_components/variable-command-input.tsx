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
import { useTranslations } from "next-intl";
import { BracketsCurly } from "@/components/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { knownRefLabels, variableTemplate } from "@/lib/workflows/variable-catalog";
import { cn } from "@/lib/utils";

import { useNodeVariables } from "./variable-catalog-context";
import { VariableCatalogList } from "./variable-catalog-list";

interface VariableCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  controlSize?: "sm" | "default" | "lg";
  multiline?: boolean;
  className?: string;
}

export function VariableCommandInput({
  value,
  onChange,
  placeholder,
  label,
  controlSize = "sm",
  multiline = false,
  className,
}: VariableCommandInputProps) {
  const t = useTranslations("workflowsPage.variablePicker");
  const variables = useNodeVariables();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(typeof value === "string" ? value.length : 0);
  const dismissedRef = useRef(false);

  const getInputElement = useCallback(() => {
    return multiline ? textareaRef.current : inputRef.current;
  }, [multiline]);

  const known = variables.state.status === "ready" ? variables.state.catalog.variables : null;
  const refsTitle = useMemo(() => {
    if (!known || typeof value !== "string") return undefined;
    const labels = knownRefLabels(value, known);
    return labels.length > 0 ? labels.map(({ ref, label }) => `${variableTemplate(ref)} · ${label}`).join("\n") : undefined;
  }, [known, value]);

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
        return;
      }

      const cursorPos = cursorPositionRef.current;
      const before = safeValue.slice(0, cursorPos);
      const after = safeValue.slice(cursorPos);
      const newValue = before + template + after;

      onChange(newValue);
      setOpen(false);

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

    if (!textBeforeCursor.endsWith("{{")) {
      dismissedRef.current = false;
      return;
    }

    if (!open && !dismissedRef.current) {
      setOpen(true);
    }
  }, [value, open, getInputElement]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) dismissedRef.current = true;
  }, []);

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
              title={refsTitle}
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
              title={refsTitle}
              controlSize={controlSize}
              className="pr-10"
            />
          )}
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-md transition-all",
                "bg-muted text-muted-foreground hover:bg-muted hover:text-primary-ink",
                multiline ? "top-1.5" : "top-1/2 -translate-y-1/2",
              )}
              title={t("open")}
              aria-label={t("title")}
            >
              <BracketsCurly size={14} weight="bold" />
            </button>
          </PopoverTrigger>
        </div>

        <PopoverContent
          align="start"
          side="bottom"
          collisionPadding={12}
          className="z-[200] w-[420px] p-0 shadow-2xl border-border"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const input = getInputElement();
            if (!input) return;
            input.focus();
            const pos = cursorPositionRef.current;
            requestAnimationFrame(() => {
              try {
                input.setSelectionRange(pos, pos);
              } catch {
              }
            });
          }}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
              <BracketsCurly size={14} className="text-primary-ink" weight="bold" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">{t("title")}</h4>
              <p className="text-2xs text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>
          <VariableCatalogList variables={variables} onPick={handleSelectVariable} searchRef={searchInputRef} />
          <div className="flex items-center gap-3 border-t bg-muted px-3 py-2 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs">↑↓</kbd>
              {t("navigate")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs">Enter</kbd>
              {t("select")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs">Esc</kbd>
              {t("close")}
            </span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

