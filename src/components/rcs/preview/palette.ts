import type { CSSProperties } from "react";

export type RcsPreviewPlatform = "android" | "ios";

export const RCS_PREVIEW_PLATFORMS: readonly RcsPreviewPlatform[] = ["android", "ios"];

export interface RcsPreviewAgent {
  name: string;
  logoUrl?: string;
  bannerUrl?: string;
  color?: string;
  description?: string;
  verified?: boolean;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const DEFAULT_ACCENT = "#0B57D0";

export function accentStyle(color: string | undefined): CSSProperties {
  return { "--rcs-accent": color && HEX_COLOR.test(color) ? color : DEFAULT_ACCENT } as CSSProperties;
}

export const ACCENT_TEXT = "text-[color:var(--rcs-accent)] dark:text-[color:color-mix(in_srgb,var(--rcs-accent)_55%,white)]";

export const ACCENT_FILL = "bg-[color:var(--rcs-accent)]";

export interface PlatformPalette {
  screen: string;
  header: string;
  ink: string;
  muted: string;
  bubble: string;
  bubbleShape: string;
  card: string;
  cardBody: string;
  cardRule: string;
  action: string;
  chip: string;
  compose: string;
  text: string;
}

export const PALETTE: Record<RcsPreviewPlatform, PlatformPalette> = {
  android: {
    screen: "bg-white dark:bg-[#131314]",
    header: "bg-white dark:bg-[#131314]",
    ink: "text-[#1F1F1F] dark:text-[#E3E3E3]",
    muted: "text-[#5E5E5E] dark:text-[#A8ABAE]",
    bubble: "bg-[#E9EEF6] text-[#1F1F1F] dark:bg-[#2A2C2F] dark:text-[#E3E3E3]",
    bubbleShape: "rounded-[20px] rounded-bl-[6px]",
    card: "rounded-[24px] border border-[#DDE3EA] bg-white dark:border-[#3C4043] dark:bg-[#1E1F20]",
    cardBody: "text-[#1F1F1F] dark:text-[#E3E3E3]",
    cardRule: "border-[#DDE3EA] dark:border-[#3C4043]",
    action: ACCENT_TEXT,
    chip: "rounded-full border border-[#C4C7C5] bg-white dark:border-[#5F6368] dark:bg-[#131314]",
    compose: "rounded-full bg-[#F0F4F9] text-[#5E5E5E] dark:bg-[#1E1F20] dark:text-[#A8ABAE]",
    text: "text-sm leading-[1.35rem]",
  },
  ios: {
    screen: "bg-white dark:bg-black",
    header: "border-b border-black/10 bg-[#F9F9F9]/95 dark:border-white/10 dark:bg-[#1C1C1E]/95",
    ink: "text-black dark:text-white",
    muted: "text-[#8E8E93]",
    bubble: "bg-[#E9E9EB] text-black dark:bg-[#26252A] dark:text-white",
    bubbleShape: "rounded-[18px] rounded-bl-[5px]",
    card: "rounded-[18px] bg-[#E9E9EB] dark:bg-[#26252A]",
    cardBody: "text-black dark:text-white",
    cardRule: "border-black/10 dark:border-white/10",
    action: "text-[#007AFF] dark:text-[#0A84FF]",
    chip: "rounded-full border border-black/10 bg-white dark:border-white/15 dark:bg-[#1C1C1E]",
    compose: "rounded-full border border-[#C7C7CC] text-[#8E8E93] dark:border-[#3A3A3C]",
    text: "text-[15px] leading-[1.3rem]",
  },
};

export const IOS_FONT: CSSProperties = {
  fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", system-ui, sans-serif",
};
