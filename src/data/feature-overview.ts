import type { Icon } from "@phosphor-icons/react";
import {
  Brain,
  Phone,
  Monitor,
  Clock,
  Gear,
  WhatsappLogo,
  PaperPlaneTilt,
  ChatCircle,
  Megaphone,
  Users,
  FileText,
  Lightning,
  Plugs,
  PhoneCall,
  Headset,
  CalendarBlank,
  Shield,
  ChartBar,
  Waveform,
  Buildings,
  GitBranch,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import type { ColorGroup } from "@/components/elevated-design/grain-background";

export interface FeatureOverviewConfig {
  palette: ColorGroup[];
  seed: number;
  features: { icon: Icon; textKey: string }[];
}

export const featureConfigs: Record<string, FeatureOverviewConfig> = {
  agents: {
    features: [
      { icon: Brain, textKey: "agents.features.0" },
      { icon: Phone, textKey: "agents.features.1" },
      { icon: Gear, textKey: "agents.features.2" },
      { icon: Clock, textKey: "agents.features.3" },
      { icon: Buildings, textKey: "agents.features.4" },
    ],
    palette: [
      { colors: ["#3b82f6", "#2563eb"], weight: 40 },
      { colors: ["#6366f1", "#4f46e5"], weight: 30 },
      { colors: ["#1d4ed8", "#1e40af"], weight: 20 },
      { colors: ["#818cf8", "#a5b4fc"], weight: 10 },
    ],
    seed: 42,
  },

  whatsappCampaigns: {
    features: [
      { icon: Megaphone, textKey: "whatsappCampaigns.features.0" },
      { icon: ChatCircle, textKey: "whatsappCampaigns.features.1" },
      { icon: Monitor, textKey: "whatsappCampaigns.features.2" },
      { icon: Brain, textKey: "whatsappCampaigns.features.3" },
      { icon: Buildings, textKey: "whatsappCampaigns.features.4" },
    ],
    palette: [
      { colors: ["#25d366", "#128c7e"], weight: 40 },
      { colors: ["#075e54", "#054d46"], weight: 30 },
      { colors: ["#34d399", "#10b981"], weight: 20 },
      { colors: ["#dcf8c6", "#a8e6cf"], weight: 10 },
    ],
    seed: 77,
  },

  whatsappCampaignsOrganic: {
    features: [
      { icon: ChatCircle, textKey: "whatsappCampaignsOrganic.features.0" },
      { icon: Brain, textKey: "whatsappCampaignsOrganic.features.1" },
      { icon: Monitor, textKey: "whatsappCampaignsOrganic.features.2" },
      { icon: Buildings, textKey: "whatsappCampaignsOrganic.features.3" },
    ],
    palette: [
      { colors: ["#06b6d4", "#0891b2"], weight: 40 },
      { colors: ["#0e7490", "#155e75"], weight: 30 },
      { colors: ["#22d3ee", "#67e8f9"], weight: 20 },
      { colors: ["#cffafe", "#a5f3fc"], weight: 10 },
    ],
    seed: 78,
  },

  campaigns: {
    features: [
      { icon: PhoneCall, textKey: "campaigns.features.0" },
      { icon: Brain, textKey: "campaigns.features.1" },
      { icon: Lightning, textKey: "campaigns.features.2" },
      { icon: Monitor, textKey: "campaigns.features.3" },
      { icon: Buildings, textKey: "campaigns.features.4" },
    ],
    palette: [
      { colors: ["#10b981", "#059669"], weight: 40 },
      { colors: ["#14b8a6", "#0d9488"], weight: 30 },
      { colors: ["#047857", "#065f46"], weight: 20 },
      { colors: ["#6ee7b7", "#a7f3d0"], weight: 10 },
    ],
    seed: 55,
  },

  campaignsReceptive: {
    features: [
      { icon: PhoneCall, textKey: "campaignsReceptive.features.0" },
      { icon: Brain, textKey: "campaignsReceptive.features.1" },
      { icon: GitBranch, textKey: "campaignsReceptive.features.2" },
      { icon: Buildings, textKey: "campaignsReceptive.features.3" },
    ],
    palette: [
      { colors: ["#3b82f6", "#2563eb"], weight: 40 },
      { colors: ["#1d4ed8", "#1e40af"], weight: 30 },
      { colors: ["#60a5fa", "#93c5fd"], weight: 20 },
      { colors: ["#bfdbfe", "#dbeafe"], weight: 10 },
    ],
    seed: 56,
  },

  workflows: {
    features: [
      { icon: GitBranch, textKey: "workflows.features.0" },
      { icon: Lightning, textKey: "workflows.features.1" },
      { icon: Monitor, textKey: "workflows.features.2" },
      { icon: Plugs, textKey: "workflows.features.3" },
      { icon: Buildings, textKey: "workflows.features.4" },
    ],
    palette: [
      { colors: ["#8b5cf6", "#7c3aed"], weight: 40 },
      { colors: ["#a78bfa", "#c4b5fd"], weight: 30 },
      { colors: ["#6d28d9", "#5b21b6"], weight: 20 },
      { colors: ["#ddd6fe", "#ede9fe"], weight: 10 },
    ],
    seed: 99,
  },

  liveChat: {
    features: [
      { icon: ChatCircle, textKey: "liveChat.features.0" },
      { icon: ArrowsClockwise, textKey: "liveChat.features.1" },
      { icon: PhoneCall, textKey: "liveChat.features.2" },
      { icon: Brain, textKey: "liveChat.features.3" },
      { icon: Monitor, textKey: "liveChat.features.4" },
    ],
    palette: [
      { colors: ["#3b82f6", "#2563eb"], weight: 35 },
      { colors: ["#06b6d4", "#0891b2"], weight: 25 },
      { colors: ["#1d4ed8", "#1e3a8a"], weight: 25 },
      { colors: ["#93c5fd", "#bae6fd"], weight: 15 },
    ],
    seed: 33,
  },

  whatsappBusinessPhones: {
    features: [
      { icon: WhatsappLogo, textKey: "whatsappBusinessPhones.features.0" },
      { icon: Shield, textKey: "whatsappBusinessPhones.features.1" },
      { icon: Users, textKey: "whatsappBusinessPhones.features.2" },
      { icon: Phone, textKey: "whatsappBusinessPhones.features.3" },
      { icon: Monitor, textKey: "whatsappBusinessPhones.features.4" },
    ],
    palette: [
      { colors: ["#25d366", "#128c7e"], weight: 35 },
      { colors: ["#075e54", "#054d46"], weight: 25 },
      { colors: ["#34d399", "#10b981"], weight: 25 },
      { colors: ["#dcf8c6", "#a8e6cf"], weight: 15 },
    ],
    seed: 66,
  },

  knowledgeBases: {
    features: [
      { icon: FileText, textKey: "knowledgeBases.features.0" },
      { icon: Lightning, textKey: "knowledgeBases.features.1" },
      { icon: Monitor, textKey: "knowledgeBases.features.2" },
      { icon: Plugs, textKey: "knowledgeBases.features.3" },
      { icon: Users, textKey: "knowledgeBases.features.4" },
    ],
    palette: [
      { colors: ["#10b981", "#059669"], weight: 35 },
      { colors: ["#06b6d4", "#0891b2"], weight: 25 },
      { colors: ["#047857", "#065f46"], weight: 25 },
      { colors: ["#6ee7b7", "#a7f3d0"], weight: 15 },
    ],
    seed: 44,
  },

  calls: {
    features: [
      { icon: PhoneCall, textKey: "calls.features.0" },
      { icon: ArrowsClockwise, textKey: "calls.features.1" },
      { icon: ChartBar, textKey: "calls.features.2" },
      { icon: Monitor, textKey: "calls.features.3" },
      { icon: Shield, textKey: "calls.features.4" },
    ],
    palette: [
      { colors: ["#3b82f6", "#2563eb"], weight: 35 },
      { colors: ["#1d4ed8", "#1e40af"], weight: 25 },
      { colors: ["#60a5fa", "#93c5fd"], weight: 25 },
      { colors: ["#1e3a8a", "#172554"], weight: 15 },
    ],
    seed: 111,
  },

  recordings: {
    features: [
      { icon: Waveform, textKey: "recordings.features.0" },
      { icon: Monitor, textKey: "recordings.features.1" },
      { icon: PhoneCall, textKey: "recordings.features.2" },
      { icon: FileText, textKey: "recordings.features.3" },
      { icon: Users, textKey: "recordings.features.4" },
    ],
    palette: [
      { colors: ["#6366f1", "#4f46e5"], weight: 35 },
      { colors: ["#818cf8", "#a5b4fc"], weight: 25 },
      { colors: ["#4338ca", "#3730a3"], weight: 25 },
      { colors: ["#c7d2fe", "#e0e7ff"], weight: 15 },
    ],
    seed: 122,
  },

  whatsappTemplates: {
    features: [
      { icon: FileText, textKey: "whatsappTemplates.features.0" },
      { icon: PaperPlaneTilt, textKey: "whatsappTemplates.features.1" },
      { icon: Lightning, textKey: "whatsappTemplates.features.2" },
      { icon: Megaphone, textKey: "whatsappTemplates.features.3" },
      { icon: Users, textKey: "whatsappTemplates.features.4" },
    ],
    palette: [
      { colors: ["#25d366", "#128c7e"], weight: 35 },
      { colors: ["#075e54", "#054d46"], weight: 25 },
      { colors: ["#34d399", "#10b981"], weight: 25 },
      { colors: ["#dcf8c6", "#a8e6cf"], weight: 15 },
    ],
    seed: 88,
  },

  sipTrunks: {
    features: [
      { icon: Plugs, textKey: "sipTrunks.features.0" },
      { icon: Monitor, textKey: "sipTrunks.features.1" },
      { icon: Lightning, textKey: "sipTrunks.features.2" },
      { icon: Users, textKey: "sipTrunks.features.3" },
      { icon: Shield, textKey: "sipTrunks.features.4" },
    ],
    palette: [
      { colors: ["#0ea5e9", "#0284c7"], weight: 35 },
      { colors: ["#0284c7", "#0369a1"], weight: 25 },
      { colors: ["#38bdf8", "#7dd3fc"], weight: 25 },
      { colors: ["#075985", "#0c4a6e"], weight: 15 },
    ],
    seed: 200,
  },

  branches: {
    features: [
      { icon: Headset, textKey: "branches.features.0" },
      { icon: PhoneCall, textKey: "branches.features.1" },
      { icon: Users, textKey: "branches.features.2" },
      { icon: ArrowsClockwise, textKey: "branches.features.3" },
      { icon: Shield, textKey: "branches.features.4" },
    ],
    palette: [
      { colors: ["#2563eb", "#1d4fd7"], weight: 40 },
      { colors: ["#0ea5e9", "#0284c7"], weight: 30 },
      { colors: ["#6366f1", "#4f46e5"], weight: 20 },
      { colors: ["#93c5fd", "#bfdbfe"], weight: 10 },
    ],
    seed: 606,
  },

  integrations: {
    features: [
      { icon: CalendarBlank, textKey: "integrations.features.0" },
      { icon: Users, textKey: "integrations.features.1" },
      { icon: Monitor, textKey: "integrations.features.2" },
      { icon: Shield, textKey: "integrations.features.3" },
      { icon: Lightning, textKey: "integrations.features.4" },
    ],
    palette: [
      { colors: ["#a855f7", "#9333ea"], weight: 35 },
      { colors: ["#7c3aed", "#6d28d9"], weight: 25 },
      { colors: ["#c084fc", "#d8b4fe"], weight: 25 },
      { colors: ["#581c87", "#4c1d95"], weight: 15 },
    ],
    seed: 150,
  },

  calendar: {
    features: [
      { icon: CalendarBlank, textKey: "calendar.features.0" },
      { icon: FileText, textKey: "calendar.features.1" },
      { icon: Lightning, textKey: "calendar.features.2" },
      { icon: Monitor, textKey: "calendar.features.3" },
      { icon: Shield, textKey: "calendar.features.4" },
    ],
    palette: [
      { colors: ["#3b82f6", "#2563eb"], weight: 35 },
      { colors: ["#6366f1", "#4f46e5"], weight: 25 },
      { colors: ["#93c5fd", "#bfdbfe"], weight: 25 },
      { colors: ["#1d4ed8", "#1e40af"], weight: 15 },
    ],
    seed: 333,
  },

  supportInboxes: {
    features: [
      { icon: Headset, textKey: "supportInboxes.features.0" },
      { icon: ArrowsClockwise, textKey: "supportInboxes.features.1" },
      { icon: Users, textKey: "supportInboxes.features.2" },
      { icon: Monitor, textKey: "supportInboxes.features.3" },
      { icon: FileText, textKey: "supportInboxes.features.4" },
    ],
    palette: [
      { colors: ["#f59e0b", "#d97706"], weight: 35 },
      { colors: ["#fbbf24", "#fcd34d"], weight: 25 },
      { colors: ["#b45309", "#92400e"], weight: 25 },
      { colors: ["#fef3c7", "#fde68a"], weight: 15 },
    ],
    seed: 444,
  },

  workspace: {
    features: [
      { icon: Users, textKey: "workspace.features.0" },
      { icon: Shield, textKey: "workspace.features.1" },
      { icon: Buildings, textKey: "workspace.features.2" },
      { icon: ArrowsClockwise, textKey: "workspace.features.3" },
      { icon: Plugs, textKey: "workspace.features.4" },
    ],
    palette: [
      { colors: ["#64748b", "#475569"], weight: 35 },
      { colors: ["#334155", "#1e293b"], weight: 25 },
      { colors: ["#94a3b8", "#cbd5e1"], weight: 25 },
      { colors: ["#3b4a6b", "#4b5580"], weight: 15 },
    ],
    seed: 500,
  },
} as const;

export type FeaturePageKey = keyof typeof featureConfigs;