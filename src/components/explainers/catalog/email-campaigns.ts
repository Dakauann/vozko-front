import { CheckCircle, Crown, EnvelopeSimple, TestTube, Users, Wallet } from "@/components/icons";

import type { ExplainerArea } from "./types";

export const emailCampaignExplainers = {
  abTest: {
    icon: TestTube,
    scene: {
      kind: "fanout",
      source: { icon: Users, label: "audience" },
      targets: [
        { icon: EnvelopeSimple, label: "variantA", note: "variantANote" },
        { icon: EnvelopeSimple, label: "variantB", note: "variantBNote" },
        { icon: Crown, label: "winner", tone: "accent", note: "winnerNote" },
      ],
      picked: 2,
    },
    steps: 3,
    footnote: true,
  },
  billing: {
    icon: Wallet,
    scene: {
      kind: "timeline",
      events: [
        { icon: Wallet, label: "charged", at: 0.08 },
        { icon: EnvelopeSimple, label: "sending", tone: "muted", at: 0.5 },
        { icon: CheckCircle, label: "refunded", tone: "accent", at: 0.92 },
      ],
      start: "launch",
      end: "end",
    },
    steps: 3,
  },
} satisfies ExplainerArea;
