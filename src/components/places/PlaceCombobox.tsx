"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Buildings, ClockCounterClockwise, Hash, MapPin, MapTrifold } from "@/components/icons";
import { usePlaceSuggestions } from "@/hooks/use-place-suggestions";
import { formatCep } from "@/lib/address/cep";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { placeId, placeRequestReady, type Place, type PlaceKind, type PlaceRequest } from "@/lib/maps/places";
import { cn } from "@/lib/utils";

type OptionGroup = PlaceKind | "recent";

interface PlaceOption {
  place: Place;
  group: OptionGroup;
}

const GROUP_ICON: Record<OptionGroup, ReactNode> = {
  city: <Buildings weight="fill" className="h-3.5 w-3.5" />,
  district: <MapPin weight="fill" className="h-3.5 w-3.5" />,
  street: <MapTrifold weight="fill" className="h-3.5 w-3.5" />,
  cep: <Hash weight="bold" className="h-3.5 w-3.5" />,
  recent: <ClockCounterClockwise weight="bold" className="h-3.5 w-3.5" />,
};

export interface PlaceComboboxProps {
  id?: string;
  label?: string;
  ariaLabel: string;
  placeholder?: string;
  value: string;
  onValueChange: (text: string) => void;
  request: Omit<PlaceRequest, "text">;
  onPick: (place: Place) => void;
  recent?: readonly Place[];
  grouped?: boolean;
  icon?: ReactNode;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "search";
  controlSize?: "sm" | "default" | "lg";
  maxLength?: number;
  className?: string;
  onFocus?: () => void;
}

function titleOf(place: Place): string {
  return place.kind === "cep" ? formatCep(place.zipCode) : place.name || place.label;
}

function detailOf(place: Place): string {
  const head = `${titleOf(place)}, `;
  const rest = place.label.startsWith(head) ? place.label.slice(head.length) : "";
  const zip = place.kind === "street" && place.zipCode ? formatCep(place.zipCode) : "";
  return [rest, zip].filter(Boolean).join(" · ");
}

export function PlaceCombobox({
  id,
  label,
  ariaLabel,
  placeholder,
  value,
  onValueChange,
  request,
  onPick,
  recent = [],
  grouped = false,
  icon,
  autoComplete = "off",
  inputMode,
  controlSize = "sm",
  maxLength,
  className,
  onFocus,
}: PlaceComboboxProps) {
  const t = useTranslations("places");
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);

  const suggestions = usePlaceSuggestions({ ...request, text: value }, open && typed);
  const asking = typed && placeRequestReady({ ...request, text: value });
  const options: PlaceOption[] = asking
    ? suggestions.places.map((place) => ({ place, group: place.kind }))
    : value.trim() === ""
      ? recent.map((place) => ({ place, group: "recent" as const }))
      : [];
  const notice = asking ? placeNotice() : null;
  const expanded = open && (options.length > 0 || notice !== null);

  function placeNotice(): string | null {
    if (suggestions.error) {
      if (suggestions.error.code === "reference_not_loaded") {
        return suggestions.coveredStates.length > 0
          ? t("notLoadedWith", { states: suggestions.coveredStates.join(", ") })
          : t("notLoaded");
      }
      return codedErrorMessage(t, suggestions.error, t("failed"));
    }
    if (suggestions.loading && suggestions.places.length === 0) return t("searching");
    if (suggestions.settled && !suggestions.loading && suggestions.places.length === 0) return t("empty");
    return null;
  }

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const choose = (option: PlaceOption) => {
    close();
    setTyped(false);
    onPick(option.place);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (options.length === 0) return;
        event.preventDefault();
        setOpen(true);
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => (current < 0 ? (step > 0 ? 0 : options.length - 1) : (current + step + options.length) % options.length));
        return;
      }
      case "Enter": {
        const picked = expanded && active >= 0 ? options[active] : undefined;
        if (!picked) return;
        event.preventDefault();
        choose(picked);
        return;
      }
      case "Escape":
        if (!expanded) return;
        event.preventDefault();
        close();
        return;
      case "Tab":
        close();
    }
  };

  const announcement = asking && suggestions.settled && !suggestions.loading && !suggestions.error ? t("results", { count: options.length }) : "";

  return (
    <div className={cn("relative", className)}>
      <ElevatedInput
        id={id}
        label={label}
        placeholder={placeholder}
        variant="outline"
        controlSize={controlSize}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(event) => {
          onValueChange(event.target.value);
          setTyped(true);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-label={label ? undefined : ariaLabel}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        autoComplete={autoComplete}
        icon={icon}
        className="w-full"
      />
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      <ul
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        hidden={!expanded}
        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 min-w-[16rem] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md"
      >
        {options.map((option, index) => {
          const firstOfGroup = index === 0 || options[index - 1].group !== option.group;
          const showHeader = firstOfGroup && (grouped || option.group === "recent");
          return (
            <li key={`${option.group}-${placeId(option.place)}`} role="presentation">
              {showHeader ? (
                <div aria-hidden="true" className="px-2 pb-1 pt-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`groups.${option.group}`)}
                </div>
              ) : null}
              <div
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
                className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground", index === active && "bg-muted")}
              >
                <span className="shrink-0 text-muted-foreground">{GROUP_ICON[option.place.kind]}</span>
                <span className="min-w-0 truncate">
                  {titleOf(option.place)}
                  {detailOf(option.place) ? <span className="text-muted-foreground">, {detailOf(option.place)}</span> : null}
                </span>
              </div>
            </li>
          );
        })}
        {notice ? (
          <li role="presentation" className="px-2 py-1.5 text-xs text-muted-foreground">
            {notice}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
