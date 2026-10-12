import type { ModelPricingInfo } from "@/lib/agents/types";
import { imageAttachments } from "@/lib/aichat/attachments";
import type { ChatAttachment } from "@/lib/aichat/types";

import { hasCapabilities, pricingIndex } from "./capabilities";

export type VisionNeed = "image" | "studio" | "ads";

const ADVERTISING_SEGMENT = /\/dashboard\/advertising(\/|$)/;

export function visionNeed({ studio, pathname, attachments }: { studio: boolean; pathname: string | null; attachments: ChatAttachment[] }): VisionNeed | null {
  if (imageAttachments(attachments).length > 0) return "image";
  if (studio) return "studio";
  if (pathname && ADVERTISING_SEGMENT.test(pathname)) return "ads";
  return null;
}

export function blindModelNeed(model: string, pricing: readonly ModelPricingInfo[], need: VisionNeed | null): VisionNeed | null {
  if (!need || !model || pricing.length === 0) return null;
  return hasCapabilities(pricingIndex(pricing).get(model), ["vision"]) ? null : need;
}
