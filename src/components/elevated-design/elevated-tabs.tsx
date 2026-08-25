"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const ElevatedTabs = TabsPrimitive.Root;

/**
 * Fluent pivot tabs — the Azure register.
 *
 * The previous form was a filled track with raised segment chips. The
 * reference shell tabs ("Recent (2)  All (2)  Favorites (0)") are a flat row
 * of labels on a hairline, with the active one carrying a brand underline and
 * a heavier label. Same Radix API, so every consumer keeps compiling; only
 * the material changed.
 */
const ElevatedTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-max min-w-full items-center justify-start gap-1 overflow-x-auto border-b border-border text-muted-foreground scrollbar-hide",
      className,
    )}
    style={{
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      ...props.style,
    }}
    {...props}
  />
));
ElevatedTabsList.displayName = TabsPrimitive.List.displayName;

const ElevatedTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // The underline is a negative-margin border so it sits ON the list's
      // hairline rather than above it — the pivot detail that makes the
      // active tab read as connected to its panel.
      "-mb-px inline-flex min-w-fit flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:rounded-[--radius] focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  />
));
ElevatedTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const ElevatedTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
ElevatedTabsContent.displayName = TabsPrimitive.Content.displayName;

export {
  ElevatedTabs as Tabs,
  ElevatedTabsList as TabsList,
  ElevatedTabsTrigger as TabsTrigger,
  ElevatedTabsContent as TabsContent,
};
