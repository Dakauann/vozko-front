import type { ReactNode } from "react";

import { CalendarBlank, PaperPlaneRight, Pause, Play, Stop } from "@/components/icons";
import type { CampaignCommand } from "@/lib/email-campaigns/status";

export const COMMAND_ICON: Record<CampaignCommand, ReactNode> = {
  start: <PaperPlaneRight className="h-4 w-4" />,
  pause: <Pause className="h-4 w-4" />,
  resume: <Play className="h-4 w-4" />,
  stop: <Stop className="h-4 w-4" />,
  unschedule: <CalendarBlank className="h-4 w-4" />,
};
