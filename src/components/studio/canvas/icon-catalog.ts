import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarBlank,
  Camera,
  ChatCircle,
  CheckCircle,
  Clock,
  Confetti,
  Crown,
  CurrencyDollar,
  Envelope,
  FacebookLogo,
  Fire,
  Globe,
  Heart,
  Hourglass,
  Image,
  InstagramLogo,
  Key,
  Leaf,
  Lightbulb,
  Lightning,
  MapPin,
  Megaphone,
  Moon,
  Package,
  PaintBrush,
  Palette,
  Phone,
  PlayCircle,
  SealCheck,
  ShieldCheck,
  Smiley,
  SmileyWink,
  Sparkle,
  Star,
  Storefront,
  Sun,
  Tag,
  Target,
  ThumbsUp,
  Timer,
  Users,
  VideoCamera,
  WhatsappLogo,
} from "@/components/icons";
import type { Icon } from "@/components/icons";

export const STUDIO_ICONS: Record<string, Icon> = {
  star: Star,
  heart: Heart,
  fire: Fire,
  sparkle: Sparkle,
  lightning: Lightning,
  confetti: Confetti,
  crown: Crown,
  "check-circle": CheckCircle,
  "seal-check": SealCheck,
  "shield-check": ShieldCheck,
  "thumbs-up": ThumbsUp,
  smiley: Smiley,
  "smiley-wink": SmileyWink,
  megaphone: Megaphone,
  tag: Tag,
  "currency-dollar": CurrencyDollar,
  storefront: Storefront,
  package: Package,
  target: Target,
  lightbulb: Lightbulb,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  "play-circle": PlayCircle,
  camera: Camera,
  "video-camera": VideoCamera,
  image: Image,
  "paint-brush": PaintBrush,
  palette: Palette,
  "chat-circle": ChatCircle,
  phone: Phone,
  envelope: Envelope,
  "whatsapp-logo": WhatsappLogo,
  "instagram-logo": InstagramLogo,
  "facebook-logo": FacebookLogo,
  "map-pin": MapPin,
  globe: Globe,
  clock: Clock,
  timer: Timer,
  hourglass: Hourglass,
  calendar: CalendarBlank,
  bell: Bell,
  users: Users,
  key: Key,
  leaf: Leaf,
  sun: Sun,
  moon: Moon,
};

export const STUDIO_ICON_IDS = Object.keys(STUDIO_ICONS);

const GLYPH_BOX = 24;

export function iconSvgMarkup(iconId: string, color: string, widthPx: number, heightPx: number): string | null {
  const glyph = STUDIO_ICONS[iconId];
  if (!glyph) return null;
  const markup = renderToStaticMarkup(createElement(glyph, { size: GLYPH_BOX, color }));
  return markup
    .replace(/calc\(([\d.]+) \* var\(--icon-stroke-scale, 1\)\)/g, "$1")
    .replace(/var\(--icon-accent, currentColor\)/g, color)
    .replace(/currentColor/g, color)
    .replace(`width="${GLYPH_BOX}" height="${GLYPH_BOX}"`, `width="${Math.max(1, Math.round(widthPx))}" height="${Math.max(1, Math.round(heightPx))}"`);
}

export function iconDataUrl(iconId: string, color: string, widthPx: number, heightPx: number): string | null {
  const markup = iconSvgMarkup(iconId, color, widthPx, heightPx);
  return markup === null ? null : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
