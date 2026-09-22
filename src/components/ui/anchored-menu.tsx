"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";


const VIEWPORT_MARGIN = 8;
const MIN_SPACE_BELOW = 160;
const MIN_HEIGHT = 120;

type Placement = {
  left: number;
  width: number;
  maxHeight: number;
} & ({ top: number; bottom?: never } | { bottom: number; top?: never });

function place(
  rect: DOMRect,
  width: number,
  gap: number,
  align: "start" | "end",
): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const rawLeft = align === "end" ? rect.right - width : rect.left;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rawLeft, vw - width - VIEWPORT_MARGIN),
  );

  const spaceBelow = vh - rect.bottom - gap - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - gap - VIEWPORT_MARGIN;

  if (spaceBelow >= MIN_SPACE_BELOW || spaceBelow >= spaceAbove) {
    return {
      left,
      width,
      top: rect.bottom + gap,
      maxHeight: Math.max(spaceBelow, MIN_HEIGHT),
    };
  }
  return {
    left,
    width,
    bottom: vh - rect.top + gap,
    maxHeight: Math.max(spaceAbove, MIN_HEIGHT),
  };
}

export interface AnchoredMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  gap?: number;
  align?: "start" | "end";
  label?: string;
  className?: string;
  children: ReactNode;
}

export function AnchoredMenu({
  open,
  anchorRef,
  onClose,
  width = 208,
  gap = 6,
  align = "end",
  label,
  className,
  children,
}: AnchoredMenuProps) {
  const [placement, setPlacement] = useState<Placement | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setPlacement(place(anchor.getBoundingClientRect(), width, gap, align));
  }, [anchorRef, width, gap, align]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, onClose, reposition]);

  if (!open || !placement || typeof document === "undefined") return null;

  const below = placement.top !== undefined;

  return createPortal(
    <>
      {
}
      <div
        aria-hidden="true"
        data-testid="anchored-menu-backdrop"
        className="fixed inset-0 z-[199]"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        role="menu"
        aria-label={label}
        style={{
          position: "fixed",
          left: placement.left,
          top: placement.top,
          bottom: placement.bottom,
          width: placement.width,
          maxHeight: placement.maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "z-[200] overflow-y-auto rounded-[--radius] border border-border bg-card py-1 shadow-xl",
          "animate-in fade-in duration-150",
          below ? "slide-in-from-top-1" : "slide-in-from-bottom-1",
          className,
        )}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export default AnchoredMenu;
