import type { TourStep } from "@/components/TourGuide";
import type { ColorGroup } from "@/components/elevated-design/grain-background";
import {
  PhoneCall,
  ChartPie,
  TrendUp,
  MagnifyingGlass,
  Eye,
  GearSix,
  Lightning,
  CheckCircle,
  Warning,
  PlayCircle,
  PauseCircle,
  Brain,
} from "@phosphor-icons/react";

export const voipDetailTourPalette: ColorGroup[] = [
  { colors: ["#6366f1", "#4f46e5"], weight: 35 },
  { colors: ["#8b5cf6", "#7c3aed"], weight: 25 },
  { colors: ["#4338ca", "#3730a3"], weight: 25 },
  { colors: ["#a78bfa", "#c4b5fd"], weight: 15 },
];
export const voipDetailTourSeed = 8800;

export const voipDetailTourSteps: TourStep[] = [
  {
    target: "[data-tour='vd-header']",
    placement: "bottom",
    badge: "steps.header.badge",
    title: "steps.header.title",
    subtitle: "steps.header.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 1,
    features: [
      { icon: PhoneCall, text: "steps.header.f0" },
      { icon: PlayCircle, text: "steps.header.f1" },
      { icon: PauseCircle, text: "steps.header.f2" },
    ],
  },
  {
    target: "[data-tour='vd-status']",
    placement: "bottom",
    badge: "steps.status.badge",
    title: "steps.status.title",
    subtitle: "steps.status.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 2,
    features: [
      { icon: Lightning, text: "steps.status.f0" },
      { icon: Brain, text: "steps.status.f1" },
    ],
  },
  {
    target: "[data-tour='vd-metrics']",
    placement: "bottom",
    badge: "steps.metrics.badge",
    title: "steps.metrics.title",
    subtitle: "steps.metrics.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 3,
    features: [
      { icon: ChartPie, text: "steps.metrics.f0" },
      { icon: CheckCircle, text: "steps.metrics.f1" },
      { icon: Warning, text: "steps.metrics.f2" },
    ],
  },
  {
    target: "[data-tour='vd-call-flow']",
    placement: "bottom",
    badge: "steps.callFlow.badge",
    title: "steps.callFlow.title",
    subtitle: "steps.callFlow.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 4,
    features: [
      { icon: PhoneCall, text: "steps.callFlow.f0" },
      { icon: TrendUp, text: "steps.callFlow.f1" },
    ],
  },
  {
    target: "[data-tour='vd-success-rate']",
    placement: "bottom",
    badge: "steps.successRate.badge",
    title: "steps.successRate.title",
    subtitle: "steps.successRate.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 5,
    features: [
      { icon: TrendUp, text: "steps.successRate.f0" },
      { icon: ChartPie, text: "steps.successRate.f1" },
    ],
  },
  {
    target: "[data-tour='vd-analysis']",
    placement: "left",
    badge: "steps.analysis.badge",
    title: "steps.analysis.title",
    subtitle: "steps.analysis.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 6,
    features: [
      { icon: Brain, text: "steps.analysis.f0" },
      { icon: ChartPie, text: "steps.analysis.f1" },
    ],
  },
  {
    target: "[data-tour='vd-filters']",
    placement: "bottom",
    badge: "steps.filters.badge",
    title: "steps.filters.title",
    subtitle: "steps.filters.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 7,
    features: [
      { icon: MagnifyingGlass, text: "steps.filters.f0" },
      { icon: Brain, text: "steps.filters.f1" },
    ],
  },
  {
    target: "[data-tour='vd-entry-filters']",
    placement: "bottom",
    badge: "steps.entryFilters.badge",
    title: "steps.entryFilters.title",
    subtitle: "steps.entryFilters.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 8,
    features: [
      { icon: MagnifyingGlass, text: "steps.entryFilters.f0" },
      { icon: GearSix, text: "steps.entryFilters.f1" },
    ],
  },
  {
    target: "[data-tour='vd-contacts']",
    placement: "top",
    badge: "steps.contacts.badge",
    title: "steps.contacts.title",
    subtitle: "steps.contacts.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 9,
    features: [
      { icon: Eye, text: "steps.contacts.f0" },
      { icon: GearSix, text: "steps.contacts.f1" },
    ],
  },
  {
    target: "[data-tour='vd-monitoring']",
    placement: "bottom",
    badge: "steps.monitoring.badge",
    title: "steps.monitoring.title",
    subtitle: "steps.monitoring.subtitle",
    palette: voipDetailTourPalette,
    seed: voipDetailTourSeed + 10,
    features: [
      { icon: Lightning, text: "steps.monitoring.f0" },
      { icon: Eye, text: "steps.monitoring.f1" },
    ],
  },
];