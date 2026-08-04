"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

import type { CSSProperties } from "react";
import { X } from "@/components/icons";
import { cn } from "@/lib/utils";

const panelShadow =
  "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";

const ElevatedDialog = DialogPrimitive.Root;
const ElevatedDialogTrigger = DialogPrimitive.Trigger;
const ElevatedDialogPortal = DialogPrimitive.Portal;
const ElevatedDialogClose = DialogPrimitive.Close;

const ElevatedDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100] bg-black/25 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:pointer-events-none",
      className,
    )}
    {...props}
  />
));
ElevatedDialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const ElevatedDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    overlayClassName?: string;
  }
>(({ className, children, style, overlayClassName, ...props }, ref) => {
  const [layoutStyle, setLayoutStyle] = React.useState<CSSProperties>({
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  });

  React.useEffect(() => {
    const updateLayout = () => {
      if (window.innerWidth < 640) {
        const safeTop = "env(safe-area-inset-top, 0px)";
        setLayoutStyle({
          left: "50%",
          top: `calc(${safeTop} + 5rem + 8px)`,
          transform: "translateX(-50%)",
          height: `calc(100dvh - ${safeTop} - 5rem - 8px)`,
          maxHeight: `calc(100dvh - ${safeTop} - 5rem - 8px)`,
        });
        return;
      }

      setLayoutStyle({
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      });
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  return (
    <ElevatedDialogPortal>
      <ElevatedDialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-[101] flex w-full max-w-[520px] flex-col gap-6 rounded-[--radius] border border-black/8 bg-card px-7 py-6 shadow-[0_25px_80px_-35px_rgba(15,23,42,0.4)] transition-all duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className,
        )}
        style={{
          boxShadow: panelShadow,
          ...layoutStyle,
          ...style,
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-card text-muted-foreground transition-colors duration-150 hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none"
          style={{ boxShadow: panelShadow }}
        >
          <X weight="bold" className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </ElevatedDialogPortal>
  );
});
ElevatedDialogContent.displayName = DialogPrimitive.Content.displayName;

const ElevatedDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2 text-left", className)} {...props} />
);
ElevatedDialogHeader.displayName = "ElevatedDialogHeader";

const ElevatedDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-2 sm:flex-row sm:justify-end", className)}
    {...props}
  />
);
ElevatedDialogFooter.displayName = "ElevatedDialogFooter";

const ElevatedDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-xl font-semibold text-foreground",
      className,
    )}
    {...props}
  />
));
ElevatedDialogTitle.displayName = DialogPrimitive.Title.displayName;

const ElevatedDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
ElevatedDialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  ElevatedDialog,
  ElevatedDialogPortal,
  ElevatedDialogOverlay,
  ElevatedDialogTrigger,
  ElevatedDialogClose,
  ElevatedDialogContent,
  ElevatedDialogHeader,
  ElevatedDialogFooter,
  ElevatedDialogTitle,
  ElevatedDialogDescription,
};
