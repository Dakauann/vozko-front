"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

import { X } from "@/components/icons";
import { cn } from "@/lib/utils";

function ElevatedSheet({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="elevated-sheet" {...props} />;
}

function ElevatedSheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return (
    <SheetPrimitive.Trigger data-slot="elevated-sheet-trigger" {...props} />
  );
}

function ElevatedSheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="elevated-sheet-close" {...props} />;
}

function ElevatedSheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="elevated-sheet-portal" {...props} />;
}

function ElevatedSheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="elevated-sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[80] bg-black/30",
        className
      )}
      {...props}
    />
  );
}

function ElevatedSheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <ElevatedSheetPortal>
      <ElevatedSheetOverlay />
      <SheetPrimitive.Content
        data-slot="elevated-sheet-content"
        className={cn(
          // --card, not --background. A drawer is an elevated panel; setting it
          // to the CANVAS colour made it a flat grey slab sitting on the page
          // instead of a sheet lifted off it. Card is lighter than the canvas in
          // light and lighter than it in dark, so this reads as a lift in both.
          "bg-card data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-[81] flex flex-col gap-4 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",

          // One shadow declaration, not two. The line below this used to be an
          // arbitrary `[box-shadow:inset...]` property, which is a plain
          // box-shadow declaration and therefore REPLACED the six-layer drop
          // shadow rather than adding to it — the drawer has been shipping with
          // a 1px inset line and no elevation at all.
          "shadow-[0px_0.7066px_0.7066px_-0.6667px_rgba(0,0,0,0.08),0px_1.8066px_1.8066px_-1.3333px_rgba(0,0,0,0.08),0px_3.6218px_3.6218px_-2px_rgba(0,0,0,0.07),0px_6.8656px_6.8656px_-2.6667px_rgba(0,0,0,0.07),0px_13.6468px_13.6468px_-3.3333px_rgba(0,0,0,0.05),0px_30px_30px_-4px_rgba(0,0,0,0.02)]",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l border-border-strong sm:max-w-md rounded-l-2xl",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r border-border-strong sm:max-w-md rounded-r-2xl",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b border-border-strong rounded-b-2xl",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t border-border-strong rounded-t-2xl",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className={cn(
            "absolute right-6 top-6 rounded-full p-2 opacity-70 shadow-sm transition-all",
            "hover:bg-muted hover:opacity-100",
            // Was an inline style={{boxShadow}}, which outranks every class and
            // silently suppressed the ring below; and `outline-hidden` is v4
            // syntax, so on Tailwind 3 it compiled to nothing.
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:pointer-events-none",
          )}
        >
          <X weight="bold" className="size-5 text-foreground" />
          <span className="sr-only">Fechar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </ElevatedSheetPortal>
  );
}

function ElevatedSheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="elevated-sheet-header"
      className={cn("flex flex-col gap-2 p-6 pb-4", className)}
      {...props}
    />
  );
}

function ElevatedSheetFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="elevated-sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-6 pt-4", className)}
      {...props}
    />
  );
}

function ElevatedSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="elevated-sheet-title"
      className={cn("font-display text-foreground text-2xl font-semibold tracking-[0.01em]", className)}
      {...props}
    />
  );
}

function ElevatedSheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="elevated-sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  ElevatedSheet,
  ElevatedSheetTrigger,
  ElevatedSheetClose,
  ElevatedSheetContent,
  ElevatedSheetHeader,
  ElevatedSheetFooter,
  ElevatedSheetTitle,
  ElevatedSheetDescription,
};
