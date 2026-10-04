import {
  Buildings,
  ChartBar,
  Handshake,
  Headset,
  Megaphone,
  Robot,
  UserGear,
  Users,
  Wallet,
  type Icon,
} from "@/components/icons";

import type { RolePresetKey } from "./types";

export type RolePlate = "plate-1" | "plate-2" | "plate-3" | "plate-4" | "plate-5" | "plate-neutral";

export interface RoleTheme {
  plate: RolePlate;
  icon: Icon;
}

export const ROLE_THEMES: Record<RolePresetKey, RoleTheme> = {
  operator: { plate: "plate-1", icon: Headset },
  supervisor: { plate: "plate-4", icon: Users },
  manager: { plate: "plate-2", icon: Buildings },
  sales: { plate: "plate-3", icon: Handshake },
  analyst: { plate: "plate-4", icon: ChartBar },
  marketing: { plate: "plate-5", icon: Megaphone },
  automation: { plate: "plate-2", icon: Robot },
  finance: { plate: "plate-1", icon: Wallet },
};

export const NEUTRAL_ROLE_THEME: RoleTheme = { plate: "plate-neutral", icon: UserGear };

export function roleTheme(presetKey?: string | null): RoleTheme {
  if (!presetKey) return NEUTRAL_ROLE_THEME;
  return Object.prototype.hasOwnProperty.call(ROLE_THEMES, presetKey)
    ? ROLE_THEMES[presetKey as RolePresetKey]
    : NEUTRAL_ROLE_THEME;
}

export const PLATE_TILE_CLASS: Record<RolePlate, string> = {
  "plate-1": "tile-1",
  "plate-2": "tile-2",
  "plate-3": "tile-3",
  "plate-4": "tile-4",
  "plate-5": "tile-5",
  "plate-neutral": "bg-[hsl(var(--plate-neutral))] text-white",
};
