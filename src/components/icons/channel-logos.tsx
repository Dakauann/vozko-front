"use client";

import type { IconProps } from "@phosphor-icons/react";
import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Official channel marks in their real brand colours.
 *
 * Phosphor's WhatsappLogo/InstagramLogo are generic monochrome glyphs that take
 * their colour from `currentColor`. That is fine for a UI affordance, but a channel
 * badge is an identity signal: an operator scanning a mixed inbox recognises the
 * green phone and the Instagram gradient far faster than they read a label. These
 * are the actual marks, so they read as the product they represent.
 *
 * Instagram's brand is a gradient, not a colour, which is why it cannot simply be a
 * className. The gradient needs a document-unique id, two of these on one page
 * sharing an id would make the second silently inherit the first's stops, so the
 * id comes from useId().
 *
 * They take Phosphor's IconProps so they can be dropped in anywhere a Phosphor
 * icon is expected, notably the sidebar's nav table, but only `className` is
 * honoured. `weight` and `color` are accepted and ignored on purpose: these are
 * fixed brand artwork, and a brand mark that changes stroke weight or colour with
 * the surrounding UI is no longer the brand mark.
 */

/** Instagram's official gradient, warm bottom-left to violet top-right. */
export function InstagramLogoColor({ className }: IconProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <defs>
        <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="5%" stopColor="#FDF497" />
          <stop offset="45%" stopColor="#FD5949" />
          <stop offset="60%" stopColor="#D6249F" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.439.645 1.439 1.439z"
      />
    </svg>
  );
}

/** WhatsApp's official mark in brand green (#25D366). */
export function WhatsAppLogoColor({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </svg>
  );
}

/**
 * Telegram's official mark.
 *
 * The brand is a circle in Telegram blue (#26A5E4) with a white paper plane, so
 * unlike WhatsApp's single-colour glyph the circle is drawn explicitly, a
 * currentColor-tinted Phosphor glyph reads as a generic send arrow rather than
 * as Telegram.
 */
export function TelegramLogoColor({ className }: IconProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#2AABEE" />
          <stop offset="100%" stopColor="#229ED9" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill={`url(#${gradientId})`} />
      <path
        fill="#FFFFFF"
        d="M5.491 11.874c3.5-1.525 5.834-2.53 7.001-3.017 3.334-1.386 4.027-1.627 4.479-1.635.099-.002.321.023.465.14.121.099.155.232.171.325.016.093.036.306.02.472-.181 1.9-.964 6.512-1.362 8.641-.169.901-.501 1.203-.822 1.233-.698.064-1.228-.462-1.904-.905-1.058-.693-1.655-1.125-2.682-1.801-1.187-.782-.418-1.211.259-1.913.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.253-.242-1.865-.441-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.894-.663z"
      />
    </svg>
  );
}

/**
 * The mark for a conversation's channel.
 *
 * Kept as one lookup so every surface that shows a channel, the CRM inbox, the
 * conversation header, search results, stays consistent. Adding a channel is one
 * case here rather than a hunt through switch statements.
 */
export function ChannelLogo({
  channel,
  className,
}: {
  channel: string | null | undefined;
  className?: string;
}) {
  switch (channel) {
    case "instagram":
      return <InstagramLogoColor className={className} />;
    case "whatsapp":
      return <WhatsAppLogoColor className={className} />;
    case "telegram":
      return <TelegramLogoColor className={className} />;
    default:
      return null;
  }
}
