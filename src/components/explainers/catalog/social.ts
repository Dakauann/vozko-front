import {
  Bell,
  Brain,
  CalendarCheck,
  ChartLineUp,
  ChatCircleDots,
  ChatsCircle,
  ChatText,
  Funnel,
  ImageSquare,
  PaperPlaneTilt,
  PencilSimple,
  Power,
  Sparkle,
  Tag,
  Target,
  Warning,
  WhatsappLogo,
} from "@/components/icons";

import type { ExplainerArea } from "./types";

export const socialExplainers = {
  postSchedule: {
    icon: CalendarCheck,
    scene: {
      kind: "timeline",
      events: [
        { at: 0.15, icon: PencilSimple, label: "create" },
        { at: 0.85, icon: CalendarCheck, label: "publish", tone: "accent" },
      ],
      start: "min",
      end: "max",
    },
    steps: 3,
  },
  postCommentRule: {
    icon: Sparkle,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatCircleDots, label: "comment" },
        { icon: Funnel, label: "rule" },
        { icon: PaperPlaneTilt, label: "reply" },
        { icon: ChatsCircle, label: "inbox", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  postAnalysis: {
    icon: ChartLineUp,
    scene: {
      kind: "compare",
      off: { label: "inherit", rows: [{ label: "accountTopics" }, { label: "accountModel" }] },
      on: { label: "own", rows: [{ label: "ownTopics" }, { label: "moreContext" }] },
    },
    steps: 3,
    footnote: true,
  },
  postOwnTopics: {
    icon: Tag,
    scene: {
      kind: "compare",
      off: { label: "inherit", rows: [{ label: "accountList" }, { label: "other" }] },
      on: { label: "own", rows: [{ label: "postList" }, { label: "other" }] },
    },
    steps: 3,
  },
  commentRuleEnabled: {
    icon: Power,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircleDots, label: "comment" },
      targets: [
        { icon: Funnel, label: "first" },
        { icon: Funnel, label: "second" },
        { icon: Funnel, label: "third" },
      ],
      picked: 1,
    },
    steps: 3,
  },
  commentRuleScope: {
    icon: Target,
    scene: {
      kind: "fanout",
      source: { icon: Funnel, label: "rule" },
      targets: [
        { icon: ImageSquare, label: "otherPost", tone: "muted" },
        { icon: ImageSquare, label: "thisPost" },
        { icon: ImageSquare, label: "anotherPost", tone: "muted" },
      ],
      picked: 1,
    },
    steps: 3,
  },
  commentAnalysis: {
    icon: Brain,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatCircleDots, label: "comment" },
        { icon: Brain, label: "ai" },
        { icon: Tag, label: "classified", tone: "accent" },
      ],
    },
    steps: 4,
    footnote: true,
  },
  alertRuleEnabled: {
    icon: Bell,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChartLineUp, label: "analysis" },
        { icon: Warning, label: "limit", tone: "warning" },
        { icon: WhatsappLogo, label: "notice", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  alertBrief: {
    icon: Sparkle,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Bell, label: "alert" },
        { icon: Brain, label: "ai" },
        { icon: ChatText, label: "withReading", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
} satisfies ExplainerArea;
