/** Icon prop types. Kept in their own module so ./glyphs.tsx and ./index.tsx
 * can both import them without a cycle. Re-exported from ./index.tsx, which is
 * where every consumer imports them from. */
import type * as React from "react";

/** The legacy weight vocabulary. Accepted for source compatibility; ignored. */
export type IconWeight =
  | "thin"
  | "light"
  | "regular"
  | "bold"
  | "fill"
  | "duotone";

export interface IconProps
  extends Omit<React.ComponentPropsWithoutRef<"svg">, "ref"> {
  size?: number | string;
  /** No-op. The set ships a single stroke weight. */
  weight?: IconWeight;
  mirrored?: boolean;
  color?: string;
}

export type Icon = React.FC<IconProps>;
