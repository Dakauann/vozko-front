import type { TourStep } from "@/components/TourGuide";
import type { ColorGroup } from "@/components/elevated-design/grain-background";
import {
  WhatsappLogo,
  ChartPie,
  CheckCircle,
  Warning,
  MagnifyingGlass,
  Eye,
  PlayCircle,
  PauseCircle,
  Brain,
  Lightning,
  Tag,
} from "@phosphor-icons/react";

export const whatsappDetailTourPalette: ColorGroup[] = [
  { colors: ["#25d366", "#128c7e"], weight: 35 },
  { colors: ["#06b6d4", "#0891b2"], weight: 25 },
  { colors: ["#0d9488", "#0f766e"], weight: 25 },
  { colors: ["#6ee7b7", "#a7f3d0"], weight: 15 },
];
export const whatsappDetailTourSeed = 10011;

export const whatsappDetailTourSteps: TourStep[] = [
  {
    target: "[data-tour='wd-header']",
    placement: "bottom",
    badge: "steps.header.badge",
    title: "steps.header.title",
    subtitle: "steps.header.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 1,
    features: [
      { icon: WhatsappLogo, text: "steps.header.f0" },
      { icon: PlayCircle, text: "steps.header.f1" },
    ],
  },
  {
    target: "[data-tour='wd-info']",
    placement: "bottom",
    badge: "steps.info.badge",
    title: "steps.info.title",
    subtitle: "steps.info.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 2,
    features: [
      { icon: WhatsappLogo, text: "steps.info.f0" },
      { icon: Brain, text: "steps.info.f1" },
      { icon: Tag, text: "steps.info.f2" },
    ],
  },
  {
    target: "[data-tour='wd-metrics']",
    placement: "bottom",
    badge: "steps.metrics.badge",
    title: "steps.metrics.title",
    subtitle: "steps.metrics.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 3,
    features: [
      { icon: ChartPie, text: "steps.metrics.f0" },
      { icon: CheckCircle, text: "steps.metrics.f1" },
      { icon: Warning, text: "steps.metrics.f2" },
    ],
  },
  {
    target: "[data-tour='wd-filters']",
    placement: "bottom",
    badge: "steps.filters.badge",
    title: "steps.filters.title",
    subtitle: "steps.filters.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 4,
    features: [
      { icon: MagnifyingGlass, text: "steps.filters.f0" },
      { icon: Brain, text: "steps.filters.f1" },
    ],
  },
  {
    target: "[data-tour='wd-analysis']",
    placement: "left",
    badge: "steps.analysis.badge",
    title: "steps.analysis.title",
    subtitle: "steps.analysis.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 5,
    features: [
      { icon: Brain, text: "steps.analysis.f0" },
      { icon: ChartPie, text: "steps.analysis.f1" },
    ],
  },
  {
    target: "[data-tour='wd-entry-filters']",
    placement: "bottom",
    badge: "steps.entryFilters.badge",
    title: "steps.entryFilters.title",
    subtitle: "steps.entryFilters.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 6,
    features: [
      { icon: MagnifyingGlass, text: "steps.entryFilters.f0" },
      { icon: Tag, text: "steps.entryFilters.f1" },
    ],
  },
  {
    target: "[data-tour='wd-contacts']",
    placement: "top",
    badge: "steps.contacts.badge",
    title: "steps.contacts.title",
    subtitle: "steps.contacts.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 7,
    features: [
      { icon: Eye, text: "steps.contacts.f0" },
      { icon: Tag, text: "steps.contacts.f1" },
      { icon: Warning, text: "steps.contacts.f2" },
    ],
  },
  {
    target: "[data-tour='wd-monitoring']",
    placement: "bottom",
    badge: "steps.monitoring.badge",
    title: "steps.monitoring.title",
    subtitle: "steps.monitoring.subtitle",
    palette: whatsappDetailTourPalette,
    seed: whatsappDetailTourSeed + 8,
    features: [
      { icon: Lightning, text: "steps.monitoring.f0" },
      { icon: Eye, text: "steps.monitoring.f1" },
    ],
  },
];