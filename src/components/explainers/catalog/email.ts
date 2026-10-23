import { ArrowBendUpLeft, ArrowsClockwise, EnvelopeSimple, Globe, Key, Lightning, PaperPlaneTilt, Prohibit, ShieldCheck, WebhooksLogo } from "@/components/icons";

import type { ExplainerArea } from "./types";

export const emailExplainers = {
  ladder: {
    icon: ShieldCheck,
    scene: {
      kind: "flow",
      nodes: [
        { icon: PaperPlaneTilt, label: "probation" },
        { icon: ShieldCheck, label: "trusted", tone: "muted" },
        { icon: Globe, label: "ownDomain", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  dnsRecords: {
    icon: Key,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Key, label: "dkim" },
        { icon: PaperPlaneTilt, label: "bounces", tone: "muted" },
        { icon: ArrowBendUpLeft, label: "replies", tone: "accent" },
      ],
    },
    steps: 4,
    footnote: true,
  },
  webhookEnabled: {
    icon: WebhooksLogo,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Lightning, label: "event" },
        { icon: WebhooksLogo, label: "endpoint", tone: "muted" },
        { icon: ArrowsClockwise, label: "retries", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  fixImportTypos: {
    icon: EnvelopeSimple,
    scene: {
      kind: "flow",
      nodes: [
        { icon: EnvelopeSimple, label: "typed" },
        { icon: ArrowsClockwise, label: "suggestion", tone: "muted" },
        { icon: ShieldCheck, label: "fixed", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
  dropUndeliverableImport: {
    icon: Prohibit,
    scene: {
      kind: "flow",
      nodes: [
        { icon: Globe, label: "checked" },
        { icon: Prohibit, label: "dropped", tone: "muted" },
        { icon: PaperPlaneTilt, label: "kept", tone: "accent" },
      ],
    },
    steps: 3,
    footnote: true,
  },
} satisfies ExplainerArea;
