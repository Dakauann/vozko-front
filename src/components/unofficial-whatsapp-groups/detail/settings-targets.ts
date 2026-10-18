import type { SetupStep } from "@/lib/unofficial-whatsapp-groups/types";

export const SETUP_TARGET: Record<SetupStep, string> = {
  description: "group-setting-description",
  admins_only: "group-setting-announce",
  promote_numbers: "group-setting-participants",
};
