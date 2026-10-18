import {
  ArrowSquareOut,
  Buildings,
  CalendarCheck,
  ChatCircle,
  ChatText,
  CheckCircle,
  Eye,
  Funnel,
  IdentificationBadge,
  MapPin,
  MapTrifold,
  Megaphone,
  NotePencil,
  Prohibit,
  Robot,
  ShieldCheck,
  Sparkle,
  Table,
  Tag,
  UserCheck,
  UserCircle,
  UserPlus,
  UsersThree,
} from "@/components/icons";

import type { ExplainerArea } from "./types";

export const crmExplainers = {
  signMessage: {
    icon: IdentificationBadge,
    scene: {
      kind: "flow",
      nodes: [
        { icon: ChatText, label: "text" },
        { icon: UserCircle, label: "name" },
        { icon: ChatCircle, label: "client", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  requiredField: {
    icon: NotePencil,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: CheckCircle, label: "blank" }, { icon: CheckCircle, label: "saves" }] },
      on: { label: "on", rows: [{ icon: NotePencil, label: "asks" }, { icon: Prohibit, label: "refuses" }] },
    },
    steps: 2,
    footnote: true,
  },
  classificationField: {
    icon: Tag,
    scene: {
      kind: "fanout",
      source: { icon: Tag, label: "field" },
      targets: [
        { icon: Table, label: "column" },
        { icon: MapTrifold, label: "map" },
        { icon: Funnel, label: "filter" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  whatsappOptIn: {
    icon: ShieldCheck,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Prohibit, label: "optedOut" }, { icon: Megaphone, label: "skipped" }] },
      on: { label: "on", rows: [{ icon: ShieldCheck, label: "granted" }, { icon: CalendarCheck, label: "dated" }] },
    },
    steps: 3,
    footnote: true,
  },
  exactOnly: {
    icon: MapPin,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: MapPin, label: "exact" }, { icon: MapTrifold, label: "approximate" }] },
      on: { label: "on", rows: [{ icon: MapPin, label: "exactOnly" }, { icon: Eye, label: "leftOut" }] },
    },
    steps: 3,
  },
  companyAcceptsLeads: {
    icon: Buildings,
    scene: {
      kind: "compare",
      off: { label: "off", rows: [{ icon: Prohibit, label: "refused" }, { icon: UsersThree, label: "stay" }] },
      on: { label: "on", rows: [{ icon: UserPlus, label: "joins" }, { icon: Buildings, label: "grouped" }] },
    },
    steps: 3,
    footnote: true,
  },
  customerPortfolio: {
    icon: UserCheck,
    scene: {
      kind: "fanout",
      source: { icon: ChatCircle, label: "customer" },
      targets: [
        { icon: Robot, label: "automation", tone: "muted" },
        { icon: UserCheck, label: "holder", tone: "accent" },
        { icon: UsersThree, label: "roulette", tone: "muted" },
      ],
      picked: 1,
    },
    steps: 4,
    footnote: true,
  },
  autoOpenScreens: {
    icon: ArrowSquareOut,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Sparkle, label: "elo" },
        { icon: ShieldCheck, label: "access" },
        { icon: ArrowSquareOut, label: "opens", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
} satisfies ExplainerArea;
