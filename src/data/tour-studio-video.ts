import type { TourStep } from "@/components/TourGuide";
import type { ColorGroup } from "@/components/elevated-design/grain-background";
import {
  ArrowsLeftRight,
  ChatText,
  Copy,
  DownloadSimple,
  FilmSlate,
  FilmStrip,
  ImageSquare,
  Megaphone,
  Microphone,
  SlidersHorizontal,
  Sparkle,
  Target,
  UploadSimple,
  Waveform,
} from "@/components/icons";

export const studioVideoTourPalette: ColorGroup[] = [
  { colors: ["#8b5cf6", "#7c3aed"], weight: 35 },
  { colors: ["#0ea5e9", "#0284c7"], weight: 25 },
  { colors: ["#f59e0b", "#d97706"], weight: 20 },
  { colors: ["#c4b5fd", "#bae6fd"], weight: 20 },
];
export const studioVideoTourSeed = 9417;

export const studioVideoTourSteps: TourStep[] = [
  {
    target: "[data-tour='studio-video-media']",
    placement: "right",
    badge: "steps.media.badge",
    title: "steps.media.title",
    subtitle: "steps.media.subtitle",
    palette: studioVideoTourPalette,
    seed: studioVideoTourSeed + 1,
    features: [
      { icon: UploadSimple, text: "steps.media.f0" },
      { icon: ImageSquare, text: "steps.media.f1" },
    ],
  },
  {
    target: "[data-tour='studio-video-ai']",
    placement: "right",
    badge: "steps.ai.badge",
    title: "steps.ai.title",
    subtitle: "steps.ai.subtitle",
    palette: studioVideoTourPalette,
    seed: studioVideoTourSeed + 2,
    features: [
      { icon: Waveform, text: "steps.ai.f0" },
      { icon: Microphone, text: "steps.ai.f1" },
      { icon: Sparkle, text: "steps.ai.f2" },
    ],
  },
  {
    target: "[data-tour='studio-video-timeline']",
    placement: "top",
    badge: "steps.timeline.badge",
    title: "steps.timeline.title",
    subtitle: "steps.timeline.subtitle",
    palette: studioVideoTourPalette,
    seed: studioVideoTourSeed + 3,
    features: [
      { icon: FilmStrip, text: "steps.timeline.f0" },
      { icon: Target, text: "steps.timeline.f1" },
      { icon: FilmSlate, text: "steps.timeline.f2" },
    ],
  },
  {
    target: "[data-tour='studio-video-trim']",
    placement: "top",
    badge: "steps.trim.badge",
    title: "steps.trim.title",
    subtitle: "steps.trim.subtitle",
    palette: studioVideoTourPalette,
    seed: studioVideoTourSeed + 4,
    features: [
      { icon: ArrowsLeftRight, text: "steps.trim.f0" },
      { icon: FilmSlate, text: "steps.trim.f1" },
      { icon: Copy, text: "steps.trim.f2" },
    ],
  },
  {
    target: "[data-tour='studio-video-captions']",
    placement: "right",
    badge: "steps.captions.badge",
    title: "steps.captions.title",
    subtitle: "steps.captions.subtitle",
    palette: studioVideoTourPalette,
    seed: studioVideoTourSeed + 5,
    features: [
      { icon: ChatText, text: "steps.captions.f0" },
      { icon: Waveform, text: "steps.captions.f1" },
    ],
  },
  {
    target: "[data-tour='studio-video-inspector']",
    placement: "left",
    badge: "steps.inspector.badge",
    title: "steps.inspector.title",
    subtitle: "steps.inspector.subtitle",
    palette: studioVideoTourPalette,
    seed: studioVideoTourSeed + 6,
    features: [
      { icon: SlidersHorizontal, text: "steps.inspector.f0" },
      { icon: ImageSquare, text: "steps.inspector.f1" },
    ],
  },
  {
    target: "[data-tour='studio-video-export']",
    placement: "bottom",
    badge: "steps.export.badge",
    title: "steps.export.title",
    subtitle: "steps.export.subtitle",
    palette: studioVideoTourPalette,
    seed: studioVideoTourSeed + 7,
    features: [
      { icon: DownloadSimple, text: "steps.export.f0" },
      { icon: Megaphone, text: "steps.export.f1" },
    ],
  },
];
