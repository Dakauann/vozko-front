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

// AnchoredMenu — a small menu that hangs off an element without living inside
// it.
//
// The reason this exists: a menu rendered as a child of the thing that opens it
// inherits that thing's clipping and its stacking context. On the kanban board
// both work against it. A card is a transformed, `will-change: transform`
// element, so it opens its own stacking context and no z-index inside it can
// reach over the cards that paint after it; and the column body scrolls, so
// anything hanging past the card's bottom edge is simply cut off. The menu went
// behind the cards below and its last item — the funnel move — was clipped away
// where nobody could click it.
//
// So the menu is measured against its anchor and rendered into <body>: fixed,
// at the one layer portalled overlays share in this product (z-[200], the layer
// ui/popover established), flipping above the anchor when the card sits low on
// the screen and clamping to the viewport when it sits near an edge.

/** Breathing room kept between the menu and the edge of the screen. */
const VIEWPORT_MARGIN = 8;
/** Below this much room underneath, hanging down is not worth it: flip up. */
const MIN_SPACE_BELOW = 160;
/** A menu never collapses to a sliver, even in a viewport with no room at all. */
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

  // Down by default; up only when down is genuinely cramped AND up is roomier.
  // Flipping on the first pixel of pressure makes the menu jump around for no
  // reason the operator can see.
  if (spaceBelow >= MIN_SPACE_BELOW || spaceBelow >= spaceAbove) {
    return {
      left,
      width,
      top: rect.bottom + gap,
      maxHeight: Math.max(spaceBelow, MIN_HEIGHT),
    };
  }
  // Pinned by its BOTTOM edge, so the flipped menu needs no height measurement
  // and never renders once in the wrong place before correcting itself.
  return {
    left,
    width,
    bottom: vh - rect.top + gap,
    maxHeight: Math.max(spaceAbove, MIN_HEIGHT),
  };
}

export interface AnchoredMenuProps {
  open: boolean;
  /** The element the menu hangs off — normally the button that opened it. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Called on Escape and on any click outside. */
  onClose: () => void;
  /** Menu width in px; the positioning maths needs the number, not a class. */
  width?: number;
  /** Distance between the anchor's edge and the menu. */
  gap?: number;
  /** Which of the anchor's edges the menu lines up with. */
  align?: "start" | "end";
  /** Accessible name for the menu. */
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

  // Measured in the layout phase so the menu paints where it belongs on the
  // very first frame instead of flashing at the top-left corner. A closed menu
  // keeps its last placement rather than clearing it: nothing renders from it
  // while closed, and on reopen this runs again before the browser paints.
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
    // Capture, because the anchor lives in a scrolling column and a scroll
    // event on that column does not bubble to the window.
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
      {/* The catcher. A click anywhere else dismisses the menu and goes no
          further, so the card underneath is not selected by the same click. */}
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
        // A portal keeps React-tree propagation: without these, every click and
        // every pointer-down inside the menu would still reach the card that
        // rendered it, selecting it or starting a drag.
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
