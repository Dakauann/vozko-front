import type { TourFeature, TourStep } from "@/components/TourGuide";
import type { ColorGroup } from "@/components/elevated-design/grain-background";
import {
  ArrowsClockwise,
  Brain,
  BracketsAngle,
  CalendarCheck,
  ChatCircle,
  CheckCircle,
  DeviceMobile,
  FileCsv,
  FlowArrow,
  GearSix,
  ImageSquare,
  PaperPlaneTilt,
  ShieldCheck,
  Warning,
  WhatsappLogo,
} from "@/components/icons";
import type { WhatsAppWizardStep } from "@/lib/whatsapp-campaigns/wizard";

export const whatsappCampaignsTourPalette: ColorGroup[] = [
  { colors: ["#25d366", "#128c7e"], weight: 35 },
  { colors: ["#06b6d4", "#0891b2"], weight: 25 },
  { colors: ["#0d9488", "#0f766e"], weight: 25 },
  { colors: ["#6ee7b7", "#a7f3d0"], weight: 15 },
];
export const whatsappCampaignsTourSeed = 5577;

export interface WizardTourData {
  _wizardStep: WhatsAppWizardStep;
}

export function wizardStepOfTour(step: TourStep): WhatsAppWizardStep | null {
  const data = step.data as Partial<WizardTourData> | undefined;
  return data?._wizardStep ?? null;
}

function tourStep(anchor: string, key: string, wizardStep: WhatsAppWizardStep, index: number, placement: TourStep["placement"], icons: TourFeature["icon"][]): TourStep {
  return {
    target: `[data-tour='${anchor}']`,
    placement,
    badge: `steps.${key}.badge`,
    title: `steps.${key}.title`,
    subtitle: `steps.${key}.subtitle`,
    palette: whatsappCampaignsTourPalette,
    seed: whatsappCampaignsTourSeed + index,
    data: { _wizardStep: wizardStep } satisfies WizardTourData,
    features: icons.map((icon, position) => ({ icon, text: `steps.${key}.f${position}` })),
  };
}

export const whatsappCampaignsTourSteps: TourStep[] = [
  tourStep("wc-basic-info", "basicInfo", "config", 1, "bottom", [GearSix, CheckCircle]),
  tourStep("wc-phone-template", "phone", "config", 2, "bottom", [WhatsappLogo, FlowArrow]),
  tourStep("wc-response-mode", "responseMode", "config", 3, "bottom", [ChatCircle, ArrowsClockwise]),
  tourStep("wc-analysis", "analysis", "config", 4, "bottom", [Brain, GearSix]),
  tourStep("wc-template", "template", "message", 5, "bottom", [BracketsAngle, ImageSquare]),
  tourStep("wc-preview", "preview", "message", 6, "left", [DeviceMobile, CheckCircle]),
  tourStep("wc-contacts", "contacts", "audience", 7, "bottom", [FileCsv, Warning]),
  tourStep("wc-review", "review", "review", 8, "bottom", [ShieldCheck, Warning]),
  tourStep("wc-send", "send", "send", 9, "top", [PaperPlaneTilt, CalendarCheck]),
];
