"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

import { X } from "@phosphor-icons/react";
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
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
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
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",

          "shadow-[0px_0.7066px_0.7066px_-0.6667px_rgba(0,0,0,0.08),0px_1.8066px_1.8066px_-1.3333px_rgba(0,0,0,0.08),0px_3.6218px_3.6218px_-2px_rgba(0,0,0,0.07),0px_6.8656px_6.8656px_-2.6667px_rgba(0,0,0,0.07),0px_13.6468px_13.6468px_-3.3333px_rgba(0,0,0,0.05),0px_30px_30px_-4px_rgba(0,0,0,0.02)]",
          "[box-shadow:inset_0px_3px_1px_0px_var(--shadow-highlight-strong)]",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l border-border/60 sm:max-w-sm rounded-l-[20px]",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r border-border/60 sm:max-w-sm rounded-r-[20px]",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b border-border/60 rounded-b-[20px]",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t border-border/60 rounded-t-[20px]",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-6 right-6 rounded-full p-2 opacity-70 transition-all hover:opacity-100 hover:bg-muted focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          style={{
            boxShadow:
              "0px 0.7066px 0.7066px -0.6667px rgba(0,0,0,0.08), 0px 1.8066px 1.8066px -1.3333px rgba(0,0,0,0.08), 0px 3.6218px 3.6218px -2px rgba(0,0,0,0.07), 0px 6.8656px 6.8656px -2.6667px rgba(0,0,0,0.07), 0px 13.6468px 13.6468px -3.3333px rgba(0,0,0,0.05), 0px 30px 30px -4px rgba(0,0,0,0.02), inset 0px 3px 1px 0px var(--shadow-highlight-strong)",
          }}
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
      className={cn("text-foreground text-2xl font-bold", className)}
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
