import {
  ArrowsOut,
  CheckCircle,
  Checks,
  ClipboardText,
  Clock,
  CurrencyDollar,
  Database,
  Funnel,
  Image,
  Kanban,
  Megaphone,
  Pause,
  PauseCircle,
  PaperPlaneTilt,
  Play,
  Receipt,
  Sparkle,
  Target,
  TextAa,
  UserCheck,
  UserPlus,
  UsersThree,
  Wallet,
} from "@/components/icons";

import type { ExplainerArea } from "./types";

export const adsExplainers = {
  advantageAudience: {
    icon: UsersThree,
    scene: {
      kind: "compare",
      off: { label: "offTitle", rows: [{ icon: Target, label: "offAge" }, { icon: Funnel, label: "offInterests" }] },
      on: { label: "onTitle", rows: [{ icon: Sparkle, label: "onSuggest" }, { icon: UsersThree, label: "onWider" }] },
    },
    steps: 3,
  },
  campaignBudget: {
    icon: Wallet,
    scene: {
      kind: "fanout",
      source: { icon: Wallet, label: "budget" },
      targets: [
        { icon: UsersThree, label: "setA" },
        { icon: UsersThree, label: "setB" },
        { icon: UsersThree, label: "setC" },
      ],
      picked: 0,
    },
    steps: 3,
  },
  adSchedule: {
    icon: Clock,
    scene: {
      kind: "timeline",
      events: [
        { icon: Play, label: "on", at: 0.35, tone: "accent" },
        { icon: Pause, label: "off", at: 0.75, tone: "muted" },
      ],
      start: "start",
      end: "end",
    },
    steps: 3,
    footnote: true,
  },
  creativeEnhancements: {
    icon: Sparkle,
    scene: {
      kind: "compare",
      off: { label: "offTitle", rows: [{ icon: Image, label: "offImage" }, { icon: TextAa, label: "offText" }] },
      on: { label: "onTitle", rows: [{ icon: ArrowsOut, label: "onImage" }, { icon: TextAa, label: "onText" }] },
    },
    steps: 3,
  },
  publishPaused: {
    icon: PauseCircle,
    scene: {
      kind: "flow",
      nodes: [
        { icon: PaperPlaneTilt, label: "publish" },
        { icon: Pause, label: "paused", tone: "muted" },
        { icon: Play, label: "youOn", tone: "accent" },
      ],
    },
    steps: 3,
  },
  higherIntentForm: {
    icon: UserCheck,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ClipboardText, label: "questions" },
        { icon: Checks, label: "review" },
        { icon: UserCheck, label: "lead", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  conversionsApi: {
    icon: Megaphone,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Kanban, label: "deal" },
        { icon: Database, label: "event" },
        { icon: Megaphone, label: "meta", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  conversionLead: {
    icon: UserPlus,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Kanban, label: "created" },
        { icon: UserPlus, label: "lead", tone: "accent" },
      ],
    },
    steps: 2,
  },
  conversionPurchase: {
    icon: CurrencyDollar,
    scene: {
      kind: "flow",
      nodes: [
        { icon: CheckCircle, label: "won" },
        { icon: CurrencyDollar, label: "value" },
        { icon: Receipt, label: "purchase", tone: "accent" },
      ],
    },
    steps: 2,
    footnote: true,
  },
} satisfies ExplainerArea;
