import { forwardRef } from "react";

export const DockBounds = forwardRef<HTMLDivElement>(
  function DockBounds(_, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none fixed inset-2 sm:inset-4"
      />
    );
  },
);
