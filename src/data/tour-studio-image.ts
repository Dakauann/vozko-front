import type { TourStep } from "@/components/TourGuide";
import type { ColorGroup } from "@/components/elevated-design/grain-background";
import {
  Cursor,
  DownloadSimple,
  FloppyDisk,
  Image,
  Palette,
  Sparkle,
  Square,
  Stack,
  TextT,
  UploadSimple,
} from "@/components/icons";

export const studioImageTourPalette: ColorGroup[] = [
  { colors: ["#8b5cf6", "#7c3aed"], weight: 35 },
  { colors: ["#ec4899", "#db2777"], weight: 25 },
  { colors: ["#6366f1", "#4338ca"], weight: 25 },
  { colors: ["#c4b5fd", "#fbcfe8"], weight: 15 },
];
export const studioImageTourSeed = 9104;

export const STUDIO_IMAGE_TOUR_KEY = "tour_dismissed_studio_image";

export const studioImageTourSteps: TourStep[] = [
  {
    target: "[data-tour='studio-image-panels']",
    placement: "right",
    badge: "steps.panels.badge",
    title: "steps.panels.title",
    subtitle: "steps.panels.subtitle",
    palette: studioImageTourPalette,
    seed: studioImageTourSeed + 1,
    features: [
      { icon: TextT, text: "steps.panels.f0" },
      { icon: Square, text: "steps.panels.f1" },
      { icon: UploadSimple, text: "steps.panels.f2" },
      { icon: Stack, text: "steps.panels.f3" },
    ],
  },
  {
    target: "[data-tour='studio-image-canvas']",
    placement: "bottom",
    badge: "steps.canvas.badge",
    title: "steps.canvas.title",
    subtitle: "steps.canvas.subtitle",
    palette: studioImageTourPalette,
    seed: studioImageTourSeed + 2,
    features: [
      { icon: Cursor, text: "steps.canvas.f0" },
      { icon: TextT, text: "steps.canvas.f1" },
      { icon: Image, text: "steps.canvas.f2" },
    ],
  },
  {
    target: "[data-tour='studio-image-inspector']",
    placement: "left",
    badge: "steps.inspector.badge",
    title: "steps.inspector.title",
    subtitle: "steps.inspector.subtitle",
    palette: studioImageTourPalette,
    seed: studioImageTourSeed + 3,
    features: [
      { icon: Palette, text: "steps.inspector.f0" },
      { icon: Stack, text: "steps.inspector.f1" },
    ],
  },
  {
    target: "[data-tour='studio-image-layers']",
    placement: "left",
    badge: "steps.layers.badge",
    title: "steps.layers.title",
    subtitle: "steps.layers.subtitle",
    palette: studioImageTourPalette,
    seed: studioImageTourSeed + 7,
    features: [
      { icon: Stack, text: "steps.layers.f0" },
      { icon: Cursor, text: "steps.layers.f1" },
    ],
  },
  {
    target: "[data-tour='studio-image-ai']",
    placement: "right",
    badge: "steps.ai.badge",
    title: "steps.ai.title",
    subtitle: "steps.ai.subtitle",
    palette: studioImageTourPalette,
    seed: studioImageTourSeed + 4,
    data: { _tab: "ai" },
    features: [
      { icon: Sparkle, text: "steps.ai.f0" },
      { icon: Image, text: "steps.ai.f1" },
    ],
  },
  {
    target: "[data-tour='studio-image-remove-bg']",
    placement: "right",
    badge: "steps.removeBackground.badge",
    title: "steps.removeBackground.title",
    subtitle: "steps.removeBackground.subtitle",
    palette: studioImageTourPalette,
    seed: studioImageTourSeed + 5,
    data: { _tab: "ai" },
    features: [
      { icon: Sparkle, text: "steps.removeBackground.f0" },
      { icon: Image, text: "steps.removeBackground.f1" },
    ],
  },
  {
    target: "[data-tour='studio-image-export']",
    placement: "bottom",
    badge: "steps.export.badge",
    title: "steps.export.title",
    subtitle: "steps.export.subtitle",
    palette: studioImageTourPalette,
    seed: studioImageTourSeed + 6,
    features: [
      { icon: DownloadSimple, text: "steps.export.f0" },
      { icon: FloppyDisk, text: "steps.export.f1" },
    ],
  },
];
