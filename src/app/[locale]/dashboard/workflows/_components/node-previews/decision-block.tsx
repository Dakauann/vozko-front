"use client";

import type { ReactNode } from "react";

// A compact, neutral "formula" chip for condition/logic nodes. No side-stripe and
// no color wash (both are slop): the node's purple category tile in the id bar
// already signals "this is a condition", so the content stays a quiet mono
// expression and the node reads as a logic gate, not a message card.
export function DecisionBlock({ children }: { children: ReactNode }) {
  return (
    <div className="break-words rounded-md bg-muted px-2 py-1 font-mono text-2xs leading-snug text-foreground/75">
      {children}
    </div>
  );
}

// Op emphasizes the operator/relation inside an expression. Neutral weight, not
// an accent color (the one accent, Signal Blue, is reserved for action/state).
export function Op({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}
