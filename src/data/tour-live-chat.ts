import type { TourStep } from "@/components/TourGuide";
import type { ColorGroup } from "@/components/elevated-design/grain-background";
import {
  Faders,
  ChatCircle,
  Users,
  ChatCenteredDots,
  PaperPlaneTilt,
  ArrowsClockwise,
} from "@phosphor-icons/react";

export const liveChatTourPalette: ColorGroup[] = [
  { colors: ["#3b82f6", "#2563eb"], weight: 35 },
  { colors: ["#06b6d4", "#0891b2"], weight: 25 },
  { colors: ["#1d4ed8", "#1e3a8a"], weight: 25 },
  { colors: ["#93c5fd", "#bae6fd"], weight: 15 },
];
export const liveChatTourSeed = 7733;

export const liveChatTourSteps: TourStep[] = [
  {
    target: "[data-tour='live-chat-filters']",
    placement: "bottom",
    badge: "steps.filters.badge",
    title: "steps.filters.title",
    subtitle: "steps.filters.subtitle",
    palette: liveChatTourPalette,
    seed: liveChatTourSeed + 1,
    features: [
      { icon: Faders, text: "steps.filters.f0" },
      { icon: Users, text: "steps.filters.f1" },
    ],
  },
  {
    target: "[data-tour='live-chat-inbox']",
    placement: "right",
    badge: "steps.inbox.badge",
    title: "steps.inbox.title",
    subtitle: "steps.inbox.subtitle",
    palette: liveChatTourPalette,
    seed: liveChatTourSeed + 2,
    features: [
      { icon: ChatCircle, text: "steps.inbox.f0" },
      { icon: ArrowsClockwise, text: "steps.inbox.f1" },
      { icon: Users, text: "steps.inbox.f2" },
    ],
  },
  {
    target: "[data-tour='live-chat-conversation']",
    placement: "left",
    badge: "steps.conversation.badge",
    title: "steps.conversation.title",
    subtitle: "steps.conversation.subtitle",
    palette: liveChatTourPalette,
    seed: liveChatTourSeed + 3,
    features: [
      { icon: ChatCenteredDots, text: "steps.conversation.f0" },
      { icon: PaperPlaneTilt, text: "steps.conversation.f1" },
    ],
  },
];
