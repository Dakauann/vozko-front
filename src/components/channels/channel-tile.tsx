"use client";

import { InstagramLogo, Phone, TelegramLogo, WhatsappLogo } from "@/components/icons";

import type { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";


type ChannelTileSpec = {
  plate: string;
  Glyph: Icon;
};

const CHANNEL_TILES: Record<string, ChannelTileSpec> = {
  whatsapp: { plate: "bg-[#25D366]", Glyph: WhatsappLogo },
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

export function hasChannelTile(channel: string | null | undefined): boolean {
  return Boolean(channel && channel in CHANNEL_TILES);
}

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
