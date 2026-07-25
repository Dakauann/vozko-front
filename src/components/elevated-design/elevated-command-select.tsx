"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CaretUpDown, Check, CircleNotch } from "@phosphor-icons/react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { softSurfaceWithInset } from "./shadow-presets";

const DISABLED_SHADOW =
  "0 12px 24px -20px rgba(15,23,42,0.12), inset 0 1px 0 var(--shadow-highlight)";

type ElevatedCommandOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
  keywords?: string[];
};

type ElevatedCommandSelectProps = {
  label?: string;
  options: ElevatedCommandOption[];
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string, option: ElevatedCommandOption) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  contentClassName?: string;
  commandClassName?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  onScrollEnd?: () => void;
  onOpenChange?: (open: boolean) => void;
};

const ElevatedCommandSelect = ({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  searchPlaceholder = "Pesquisar...",
  emptyMessage = "Nenhum resultado encontrado",
  className,
  contentClassName,
  commandClassName,
  disabled,
  fullWidth,
  onSearch,
  isLoading,
  onScrollEnd,
  onOpenChange: onOpenChangeProp,
}: ElevatedCommandSelectProps) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [selectedOptionCache, setSelectedOptionCache] =
    useState<ElevatedCommandOption | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentValue = value !== undefined ? (value ?? "") : internalValue;

  useEffect(() => {
    if (!currentValue) {
      setSelectedOptionCache(null);
      return;
    }

    const currentOption =
      options.find((option) => option.value === currentValue) ?? null;
    if (currentOption) {
      setSelectedOptionCache(currentOption);
    }
  }, [options, currentValue]);

  const selectedOption = useMemo(() => {
    if (!currentValue) {
      return null;
    }

    return (
      options.find((option) => option.value === currentValue) ??
      (selectedOptionCache?.value === currentValue ? selectedOptionCache : null)
    );
  }, [options, currentValue, selectedOptionCache]);

  const hasSelection = Boolean(selectedOption);

  const handleSelect = useCallback(
    (option: ElevatedCommandOption) => {
      if (option.disabled) {
        return;
      }

      setSelectedOptionCache(option);

      if (value === undefined) {
        setInternalValue(option.value);
      }

      onValueChange?.(option.value, option);
      setOpen(false);
    },
    [onValueChange, value],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) {
        return;
      }

      setOpen(nextOpen);
      onOpenChangeProp?.(nextOpen);

      if (!nextOpen) {
        setFocused(false);
      }
    },
    [disabled, onOpenChangeProp],
  );

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !onScrollEnd || isLoading) return;
    const threshold = 40;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      onScrollEnd();
    }
  }, [onScrollEnd, isLoading]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !onScrollEnd) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, onScrollEnd]);

  const floatingState = focused || open || hasSelection;

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-full border border-border bg-card px-5 py-3 text-left text-sm font-medium text-foreground transition-all duration-200 ease-out",
              "hover:border-foreground/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60",
            )}
            style={{
              boxShadow: disabled ? DISABLED_SHADOW : softSurfaceWithInset,
            }}
          >
            <span className="flex min-h-[1.25rem] flex-1 items-center gap-2 truncate text-sm text-foreground">
              {selectedOption ? (
                <>
                  {selectedOption.icon ? (
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-primary/60">
                      {selectedOption.icon}
                    </span>
                  ) : null}
                  <span className="truncate font-medium text-foreground">
                    {selectedOption.label}
                  </span>
                  {selectedOption.meta ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {selectedOption.meta}
                    </span>
                  ) : null}
                </>
              ) : null}
            </span>
            <CaretUpDown
              className="h-4 w-4 flex-shrink-0 text-muted-foreground"
              weight="bold"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          {...(fullWidth
            ? { style: { width: "var(--radix-popover-trigger-width)" } }
            : {})}
          className={cn(
            !fullWidth && "w-[320px]",
            "rounded-lg border border-border bg-card p-0 shadow-2xl",
            contentClassName,
          )}
        >
          <Command
            shouldFilter={!onSearch}
            className={cn(
              "rounded-lg bg-transparent text-foreground",
              commandClassName,
            )}
          >
            <CommandInput
              placeholder={searchPlaceholder}
              className="text-sm text-foreground"
              onValueChange={onSearch}
            />
            <CommandList ref={listRef}>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              )}
              {!isLoading && (
                <CommandGroup className="space-y-1">
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.value} ${option.label}`.toLowerCase()}
                      disabled={option.disabled}
                      keywords={option.keywords}
                      onSelect={() => handleSelect(option)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground",
                        "data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary",
                        "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
                        `border-l-4 ${
                          currentValue === option.value
                            ? "border-l-primary"
                            : "border-l-transparent"
                        } rounded-none data-[selected=true]:border-l-primary`,
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {option.icon ? (
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                            {option.icon}
                          </span>
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {option.label}
                          </p>
                          {option.description ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {option.meta ? (
                        <span
                          className="text-xs text-muted-foreground [&_svg]:pointer-events-auto [&_button]:pointer-events-auto"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {option.meta}
                        </span>
                      ) : null}
                      <Check
                        weight="bold"
                        className={cn(
                          "ml-2 h-4 w-4 flex-shrink-0 text-primary transition-opacity",
                          currentValue === option.value
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {label ? (
        <label
          className={cn(
            "absolute pointer-events-none rounded-full px-2 py-[2px] text-sm font-medium transition-all duration-200 ease-out",
            "left-5",
            floatingState
              ? cn(
                  "-ml-1 top-0 -translate-y-1/2 text-[11px] shadow-sm",
                  disabled
                    ? "bg-muted text-muted-foreground"
                    : "bg-card text-foreground",
                )
              : cn(
                  "top-1/2 -translate-y-1/2",
                  disabled ? "text-muted-foreground" : "text-muted-foreground",
                ),
          )}
          style={{ transformOrigin: "left center" }}
        >
          {label}
        </label>
      ) : null}
    </div>
  );
};

export type { ElevatedCommandOption, ElevatedCommandSelectProps };
export { ElevatedCommandSelect };
