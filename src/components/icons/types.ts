import type * as React from "react";

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
  weight?: IconWeight;
  mirrored?: boolean;
  color?: string;
}

export type Icon = React.FC<IconProps>;
