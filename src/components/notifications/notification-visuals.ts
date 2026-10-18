import {
  ChatText,
  Gear,
  Headset,
  Megaphone,
  PaperPlaneTilt,
  Plugs,
  Target,
  UsersThree,
  Wallet,
  type Icon,
} from "@/components/icons";
import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import type { NotificationCategory, NotificationSeverity } from "@/lib/notifications/types";

export const CATEGORY_ICON: Record<NotificationCategory, Icon> = {
  announcements: Megaphone,
  campaigns: PaperPlaneTilt,
  templates: ChatText,
  channels: Plugs,
  billing: Wallet,
  advertising: Target,
  team: UsersThree,
  support: Headset,
  system: Gear,
};

export const SEVERITY_CHIP: Record<NotificationSeverity, StatusChipTone | null> = {
  info: null,
  success: "healthy",
  warning: "warning",
  critical: "fault",
};
