"use client";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { addDays, format, isValid, parse, startOfDay } from "date-fns";
import { CalendarBlank, X } from "@/components/icons";
import { useMemo, useState, type MouseEvent, type ChangeEvent } from "react";
import ElevatedInput from "./elevated-input";

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseDate(value?: string) {
  if (!value) return undefined;

  if (ISO_PATTERN.test(value)) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }

  if (BR_PATTERN.test(value)) {
    const parsed = parse(value, "dd/MM/yyyy", new Date());
    return isValid(parsed) ? parsed : undefined;
  }

  return undefined;
}

function formatDate(value?: Date | null) {
  if (!value) return "";
  return format(value, "yyyy-MM-dd");
}

function formatDisplayDate(value?: Date | null) {
  if (!value) return "";
  return format(value, "dd/MM/yyyy");
}

export type ElevatedDatePickerProps = {
  id: string;
  value?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  inputClassName?: string;
  hasError?: boolean;
  
  minDate?: Date;
  
  maxDate?: Date;
  
  minDateTomorrow?: boolean;
  
  minDaysFromNow?: number;
  onChange?(value: string): void;
};

export function ElevatedDatePicker({
  id,
  value,
  label,
  placeholder,
  disabled,
  inputClassName,
  hasError,
  minDate,
  maxDate,
  minDateTomorrow,
  minDaysFromNow,
  onChange,
}: ElevatedDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const selectedDate = useMemo(() => parseDate(value), [value]);
  const displayValue = useMemo(() => {
    if (inputValue && !open) {
      return inputValue;
    }
    return selectedDate ? formatDisplayDate(selectedDate) : "";
  }, [selectedDate, inputValue, open]);

  const effectiveMinDate = useMemo(() => {
    if (minDateTomorrow) {
      return startOfDay(addDays(new Date(), 1));
    }
    if (minDaysFromNow !== undefined) {
      return startOfDay(addDays(new Date(), minDaysFromNow));
    }
    return minDate;
  }, [minDate, minDateTomorrow, minDaysFromNow]);

  function handleSelect(nextValue?: Date) {
    if (!nextValue) return;
    const normalized = formatDate(nextValue);
    onChange?.(normalized);
    setInputValue("");
    setOpen(false);
  }

  function handleManualInput(event: ChangeEvent<HTMLInputElement>) {
    const rawValue = event.target.value;
    setInputValue(rawValue);

    const parsed = parseDate(rawValue);
    if (parsed) {
      const normalized = formatDate(parsed);
      onChange?.(normalized);
    }
  }

  function handleClear(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onChange?.("");
    setInputValue("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <div className="w-full">
          <ElevatedInput
            id={id}
            type="text"
            label={label ?? placeholder}
            placeholder={placeholder ?? "DD/MM/AAAA"}
            value={displayValue}
            onChange={handleManualInput}
            disabled={disabled}
            icon={<CalendarBlank weight="fill" className="h-4 w-4" />}
            variant="outline"
            inputClassName={cn(
              "font-medium text-foreground",
              hasError
                ? "border-destructive focus-visible:ring-red-200 focus-visible:ring-offset-2"
                : "border-border focus-visible:ring-border focus-visible:ring-offset-2",
              inputClassName
            )}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="z-50 w-auto rounded-[--radius] border border-border bg-card p-4 shadow-xl"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => {
            if (effectiveMinDate && date < effectiveMinDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
          defaultMonth={effectiveMinDate ?? selectedDate}
          initialFocus
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {placeholder ?? "Selecione uma data"}
          </p>
          <button
            type="button"
            onClick={(event) => {
              handleClear(event);
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 rounded-[--radius] border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
          >
            <X weight="bold" className="h-3 w-3" /> Limpar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ElevatedDatePicker;
