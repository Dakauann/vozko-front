"use client";

import * as React from "react";

import { CaretLeft, CaretRight } from "@/components/icons";

import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "flex items-center gap-1",
        nav_button: cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        ),
        nav_button_previous: "absolute left-2",
        nav_button_next: "absolute right-2",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-full w-9 font-medium text-[0.75rem] uppercase",
        row: "flex w-full mt-1",
        cell: cn(
          "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-muted [&:has([aria-selected].day-outside)]:bg-muted",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-full [&:has(>.day-range-start)]:rounded-l-full first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full"
            : "[&:has([aria-selected])]:rounded-full",
        ),
        day: cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-full font-normal transition-colors hover:bg-muted hover:text-lamp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100",
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-sm",
        day_today: "bg-primary text-white font-semibold",
        day_outside:
          "day-outside text-muted-foreground/50 aria-selected:bg-muted aria-selected:text-muted-foreground/70",
        day_disabled: "text-muted-foreground/40 opacity-50 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-primary/15 aria-selected:text-lamp-ink",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <CaretLeft
            className={cn("h-4 w-4", className)}
            weight="bold"
            {...props}
          />
        ),
        IconRight: ({ className, ...props }) => (
          <CaretRight
            className={cn("h-4 w-4", className)}
            weight="bold"
            {...props}
          />
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
