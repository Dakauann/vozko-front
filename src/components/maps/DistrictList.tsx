"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { RetryNotice } from "@/components/elevated-design/retry-notice";
import { Checks, Radius } from "@/components/icons";
import { RADIUS_CHOICES_M } from "@/lib/maps/area";
import type { DistrictCount } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { RadiusFromPlace, type RadiusCenter } from "./RadiusFromPlace";

const FIRST_PAGE = 10;
const NEXT_PAGE = 50;

export interface DistrictListProps {
  districts: readonly DistrictCount[] | null;
  activeKey?: string | null;
  failed?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  onActivate: (district: DistrictCount) => void;
  onSelectAll?: (district: DistrictCount) => void;
  onRadius?(center: RadiusCenter, radiusM: number): void;
  className?: string;
}

const KILOMETER = 1000;

function RadiusChoices({ district, onRadius }: { district: DistrictCount; onRadius: (district: DistrictCount, radiusM: number) => void }) {
  const t = useTranslations("leadMap.districtList");
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="ml-1.5 mt-1 flex flex-wrap items-center gap-1">
      <span id={labelId} className="sr-only">
        {t("radius.label", { name: district.name })}
      </span>
      <Radius size={14} aria-hidden="true" className="text-muted-foreground" />
      <span aria-hidden="true" className="text-xs text-muted-foreground">
        {t("radius.visibleLabel")}
      </span>
      {RADIUS_CHOICES_M.map((radiusM) => (
        <button
          key={radiusM}
          type="button"
          onClick={() => onRadius(district, radiusM)}
          className="rounded-sm px-1 text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {radiusM < KILOMETER ? t("radius.meters", { value: radiusM }) : t("radius.kilometers", { value: radiusM / KILOMETER })}
        </button>
      ))}
    </div>
  );
}

export function DistrictList(props: DistrictListProps) {
  const { onRadius, className } = props;
  if (!onRadius) return <DistrictRows {...props} />;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <DistrictRows {...props} className={undefined} />
      <RadiusFromPlace onRadius={(center, radiusM) => onRadius(center, radiusM)} />
    </div>
  );
}

function DistrictRows({ districts, activeKey = null, failed = false, onRetry, retrying = false, onActivate, onSelectAll, onRadius, className }: DistrictListProps) {
  const t = useTranslations("leadMap.districtList");
  const tCommon = useTranslations("metricsOps.common");
  const format = useFormatter();
  const listId = useId();
  const hintId = useId();
  const rows = useRef<Array<HTMLButtonElement | null>>([]);
  const [shown, setShown] = useState(FIRST_PAGE);
  const [active, setActive] = useState<string | null>(activeKey);
  const [followed, setFollowed] = useState<string | null>(activeKey);
  const [focusIndex, setFocusIndex] = useState(0);

  if (activeKey !== followed) {
    setFollowed(activeKey);
    setActive(activeKey);
  }

  if (failed) {
    return (
      <RetryNotice
        className={cn("text-xs", className)}
        message={t("failed")}
        retryLabel={tCommon("retry")}
        onRetry={onRetry}
        retrying={retrying}
      />
    );
  }

  if (!districts) {
    return <span aria-hidden="true" className={cn("block h-16 w-full animate-pulse rounded-md bg-muted", className)} />;
  }

  if (districts.length === 0) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{t("empty")}</p>;
  }

  const visible = districts.slice(0, shown);
  const tabStop = Math.min(focusIndex, visible.length - 1);

  const focusRow = (index: number) => {
    const next = Math.max(0, Math.min(visible.length - 1, index));
    setFocusIndex(next);
    rows.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: visible.length - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusRow(target);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p id={hintId} className="sr-only">
        {t("hint")}
      </p>
      <ul id={listId} aria-label={t("label")} aria-describedby={hintId} className="flex flex-col">
        {visible.map((district, index) => {
          const key = district.pair;
          const selected = active === key;
          return (
            <li key={key} className="flex flex-col">
              <button
                ref={(node) => {
                  rows.current[index] = node;
                }}
                type="button"
                tabIndex={index === tabStop ? 0 : -1}
                aria-pressed={selected}
                onFocus={() => setFocusIndex(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                onClick={() => {
                  setActive(key);
                  onActivate(district);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors",
                  "hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "bg-muted font-medium",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{district.name}</span>
                <span className="font-semibold tabular-nums text-foreground">{format.number(district.count)}</span>
              </button>
              {selected && onSelectAll ? (
                <button
                  type="button"
                  onClick={() => onSelectAll(district)}
                  className="ml-1.5 mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Checks size={14} aria-hidden="true" />
                  {t("selectAll")}
                </button>
              ) : null}
              {selected && onRadius ? <RadiusChoices district={district} onRadius={onRadius} /> : null}
            </li>
          );
        })}
      </ul>
      {districts.length > shown ? (
        <button
          type="button"
          aria-controls={listId}
          onClick={() => setShown((current) => current + NEXT_PAGE)}
          className="w-fit rounded-sm text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("more")}
        </button>
      ) : null}
    </div>
  );
}
