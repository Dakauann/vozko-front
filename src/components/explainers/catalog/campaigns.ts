import { CalendarCheck, ChatText, Clock, Files, PaperPlaneTilt, Robot } from "@/components/icons";
import { SmartSendMark } from "@/components/whatsapp/smart/SmartSendArt";

import type { ExplainerArea } from "./types";

export const campaignExplainers = {
  smartSend: { icon: SmartSendMark, scene: { kind: "waves" }, steps: 3, footnote: true },
  templateInCrm: {
    icon: ChatText,
    scene: {
      kind: "compare",
      off: {
        label: "off",
        rows: [
          { icon: PaperPlaneTilt, label: "sent" },
          { icon: ChatText, label: "outsideChat" },
        ],
      },
      on: {
        label: "on",
        rows: [
          { icon: PaperPlaneTilt, label: "sent" },
          { icon: ChatText, label: "inChat" },
        ],
      },
    },
    steps: 3,
    footnote: true,
  },
  scheduledStart: {
    icon: CalendarCheck,
    scene: {
      kind: "timeline",
      events: [
        { icon: CalendarCheck, label: "saved", at: 0.05 },
        { icon: Clock, label: "waiting", tone: "muted", at: 0.45 },
        { icon: PaperPlaneTilt, label: "starts", tone: "accent", at: 0.9 },
      ],
    },
    steps: 3,
  },
  agentKnowledge: {
    icon: Files,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatText, label: "question" },
        { icon: Files, label: "excerpts" },
        { icon: Robot, label: "reply", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
} satisfies ExplainerArea;
