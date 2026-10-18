import { ChatCircle, CheckCircle, Files, GraduationCap, PlugsConnected, Robot, Sparkle, WhatsappLogo, Wrench } from "@/components/icons";

import type { ExplainerArea } from "./types";

export const agentExplainers = {
  guided: {
    icon: GraduationCap,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Robot, label: "identity" },
        { icon: Sparkle, label: "model" },
        { icon: ChatCircle, label: "prompt" },
        { icon: CheckCircle, label: "review", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  complete: {
    icon: Wrench,
    scene: {
      kind: "fanout",
      source: { icon: Robot, label: "agent" },
      targets: [
        { icon: PlugsConnected, label: "tools" },
        { icon: Files, label: "knowledge" },
        { icon: WhatsappLogo, label: "whatsapp" },
      ],
    },
    steps: 3,
    footnote: true,
  },
} satisfies ExplainerArea;
