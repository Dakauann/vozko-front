"use client";

import {
    marginBeforeWindowCloses,
    scheduleBounds,
    validateScheduledAt,
} from "@/lib/scheduled-messages/window";
import { useCallback, useMemo, useState } from "react";

import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import type { SchedulingWindow } from "@/lib/scheduled-messages/types";
import { useTranslations } from "next-intl";

type PresetKey = "1h" | "3h" | "tomorrow" | "custom";

const HOUR = 60 * 60 * 1000;

function presetInstant(key: Exclude<PresetKey, "custom">, now: Date): Date {
    if (key === "1h") return new Date(now.getTime() + HOUR);
    if (key === "3h") return new Date(now.getTime() + 3 * HOUR);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function combine(date: string, time: string): Date | null {
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return null;

    const combined = new Date(y, m - 1, d, h, min, 0, 0);
    return Number.isNaN(combined.getTime()) ? null : combined;
}

function formatDuration(ms: number): string {
    const minutes = Math.max(0, Math.floor(ms / 60_000));
    const hours = Math.floor(minutes / 60);
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

export function useScheduleWhen(window: SchedulingWindow | null) {
    const t = useTranslations("scheduledMessages");

    const bounds = useMemo(() => scheduleBounds(window), [window]);

    const [initialInstant] = useState(() => {
        const suggested = presetInstant("1h", new Date());
        const latest = scheduleBounds(window).latest;
        return latest && suggested > latest ? latest : suggested;
    });
    const [preset, setPreset] = useState<PresetKey>(() =>
        initialInstant.getTime() === presetInstant("1h", new Date()).getTime() ? "1h" : "custom",
    );
    const [date, setDate] = useState(() => toLocalDate(initialInstant));
    const [time, setTime] = useState(() => toLocalTime(initialInstant));

    const chosen = useMemo(() => combine(date, time), [date, time]);
    const validity = useMemo(
        () => (chosen ? validateScheduledAt(chosen, window) : null),
        [chosen, window],
    );
    const margin = useMemo(
        () => (chosen ? marginBeforeWindowCloses(chosen, window) : null),
        [chosen, window],
    );

    const selectPreset = useCallback((key: PresetKey) => {
        setPreset(key);
        if (key === "custom") return;
        const instant = presetInstant(key, new Date());
        setDate(toLocalDate(instant));
        setTime(toLocalTime(instant));
    }, []);

    const presetOptions = useMemo(() => {
        const now = new Date();
        const keys: Exclude<PresetKey, "custom">[] = ["1h", "3h", "tomorrow"];
        const options = keys.map((key) => {
            const fits = validateScheduledAt(presetInstant(key, now), window, now).ok;
            return {
                value: key as PresetKey,
                label: t(`dialog.presets.${key}`),
                disabled: !fits,
                title: fits ? undefined : t("dialog.presetPastWindow"),
            };
        });
        return [...options, { value: "custom" as PresetKey, label: t("dialog.presets.custom") }];
    }, [window, t]);

    const clientError = validity && !validity.ok ? t(`errors.${validity.code}`) : null;

    return {
        bounds,
        preset,
        selectPreset,
        presetOptions,
        date,
        setDate: (value: string) => {
            setPreset("custom");
            setDate(value);
        },
        time,
        setTime: (value: string) => {
            setPreset("custom");
            setTime(value);
        },
        chosen,
        valid: Boolean(chosen && validity?.ok),
        margin,
        clientError,
    };
}

export type ScheduleWhen = ReturnType<typeof useScheduleWhen>;

export default function ScheduleWhenField({ when }: { when: ScheduleWhen }) {
    const t = useTranslations("scheduledMessages");

    const deliverySummary = when.chosen
        ? when.chosen.toLocaleString(undefined, {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "";

    return (
        <section className="space-y-2">
            <p className="legend">{t("dialog.whenLabel")}</p>

            <ElevatedPillToggle
                options={when.presetOptions}
                value={when.preset}
                onChange={when.selectPreset}
                size="sm"
                aria-label={t("dialog.whenLabel")}
            />

            <div className="grid grid-cols-2 gap-3">
                <ElevatedDatePicker
                    id="schedule-date"
                    label={t("dialog.dateLabel")}
                    value={when.date}
                    onChange={when.setDate}
                    minDate={when.bounds.earliest ?? undefined}
                    maxDate={when.bounds.latest ?? undefined}
                    hasError={Boolean(when.clientError)}
                />
                <ElevatedInput
                    id="schedule-time"
                    type="time"
                    label={t("dialog.timeLabel")}
                    value={when.time}
                    onChange={(event) => when.setTime(event.target.value)}
                />
            </div>

            {when.chosen && !when.clientError && (
                <p className="text-2xs text-muted-foreground">
                    {t("dialog.deliverySummary", { when: deliverySummary })}
                    {when.margin !== null
                        ? ` — ${t("dialog.marginSuffix", { margin: formatDuration(when.margin) })}`
                        : ""}
                </p>
            )}
        </section>
    );
}
