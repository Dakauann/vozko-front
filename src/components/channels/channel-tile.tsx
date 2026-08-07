"use client";

import { InstagramLogo, Phone, TelegramLogo, WhatsappLogo } from "@/components/icons";

import type { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * A channel's brand lockup: its own colour behind, its glyph in white.
 *
 * This is the shape the product already uses for WhatsApp on the metrics cards,
 * and it is here so every other channel gets the same treatment instead of the
 * one it happened to be given. Before this existed, a channel the author had not
 * thought about fell through to a muted plate with a telephone glyph — so
 * Telegram and unofficial WhatsApp both rendered as "phone", on a tile that
 * looked disabled next to WhatsApp's green.
 *
 * The glyph is the MONOCHROME mark, not the full-colour brand SVG: a coloured
 * mark on its own coloured plate is the wash this system bans, and white on the
 * brand's own fill is the lockup every one of these companies publishes.
 */

type ChannelTileSpec = {
  /** The brand's own fill. A gradient for Instagram, whose brand IS a gradient. */
  plate: string;
  Glyph: Icon;
};

const CHANNEL_TILES: Record<string, ChannelTileSpec> = {
  whatsapp: { plate: "bg-[#25D366]", Glyph: WhatsappLogo },
  // Graphite rather than WhatsApp green, and that difference is the whole point:
  // the two transports send from different numbers under different rules, so an
  // operator who cannot tell them apart cannot know what they are allowed to
  // send. Same glyph, because to the customer it IS WhatsApp.
  unofficial_whatsapp: { plate: "bg-[#54656F]", Glyph: WhatsappLogo },
  instagram: {
    plate: "bg-[linear-gradient(45deg,#FEDA75,#FA7E1E_25%,#D62976_50%,#962FBF_75%,#4F5BD5)]",
    Glyph: InstagramLogo,
  },
  telegram: { plate: "bg-[#229ED9]", Glyph: TelegramLogo },
  voice: { plate: "bg-[#8B5CF6]", Glyph: Phone },
};

const SIZES = {
  sm: { box: "h-7 w-7 rounded-md", glyph: "h-3.5 w-3.5" },
  md: { box: "h-9 w-9 rounded-[--radius]", glyph: "h-4 w-4" },
  lg: { box: "h-12 w-12 rounded-[--radius]", glyph: "h-6 w-6" },
} as const;

/** Whether this channel has a lockup, so callers can branch before rendering. */
export function hasChannelTile(channel: string | null | undefined): boolean {
  return Boolean(channel && channel in CHANNEL_TILES);
}

/**
 * The plate classes alone, for the surfaces that build their own icon box and
 * only need the ground. Several pages had hand-typed `bg-[#25d366] text-white`,
 * which is the right shape but a second copy of the brand value — the two drift
 * the first time one of these networks refreshes its palette.
 */
export function channelPlate(channel: string | null | undefined): string {
  const spec = CHANNEL_TILES[channel ?? ""];
  return spec ? `${spec.plate} text-white` : "tile-neutral";
}

export function ChannelTile({
  channel,
  size = "md",
  className,
}: {
  channel: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const spec = CHANNEL_TILES[channel ?? ""];
  const s = SIZES[size];

  // An unknown channel gets the neutral plate rather than a wrong brand: a
  // channel wearing another network's colours is worse than one wearing none.
  if (!spec) {
    return (
      <div
        className={cn(
          "tile-neutral flex shrink-0 items-center justify-center",
          s.box,
          className,
        )}
      >
        <Phone className={s.glyph} weight="fill" />
      </div>
    );
  }

  const { plate, Glyph } = spec;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        s.box,
        plate,
        className,
      )}
    >
      <Glyph className={cn(s.glyph, "text-white")} weight="fill" />
    </div>
  );
}
