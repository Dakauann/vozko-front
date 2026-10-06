"use client";

import type { IconProps } from "@/components/icons";
import { useId } from "react";

import { cn } from "@/lib/utils";


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

export function WhatsAppUnofficialLogo({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4 text-muted-foreground", className)}
    >
      <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

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

export function FacebookMessengerLogoColor({ className }: IconProps) {
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
        <radialGradient id={gradientId} cx="19%" cy="99%" r="109%">
          <stop offset="0%" stopColor="#0099FF" />
          <stop offset="61%" stopColor="#A033FF" />
          <stop offset="93%" stopColor="#FF5280" />
          <stop offset="100%" stopColor="#FF7061" />
        </radialGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 0 0-.64.05l-2.39 1.05a.96.96 0 0 1-1.35-.85l-.07-2.14a.97.97 0 0 0-.32-.68A11.39 11.39 0 0 1 .002 11.64zm8.32-2.19-3.52 5.6c-.35.53.32 1.14.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.8 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 0 0-2.61.48z"
      />
    </svg>
  );
}

export function FacebookLogoColor({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <path
        fill="#0866FF"
        d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
      />
    </svg>
  );
}

export function MetaLogoColor({ className }: IconProps) {
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
        <linearGradient id={gradientId} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0064E1" />
          <stop offset="100%" stopColor="#0082FB" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"
      />
    </svg>
  );
}

export function VoiceLogoColor({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <circle cx="12" cy="12" r="12" fill="#8B5CF6" />
      <path
        fill="#FFFFFF"
        transform="translate(12 12) scale(0.58) translate(-12 -12)"
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
      />
    </svg>
  );
}

export function WebchatLogoColor({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <circle cx="12" cy="12" r="12" fill="#0D9488" />
      <path
        fill="#FFFFFF"
        d="M8.2 6.5h7.6a2.3 2.3 0 0 1 2.3 2.3v4.6a2.3 2.3 0 0 1-2.3 2.3h-2.3l-3.45 3a.46.46 0 0 1-.77-.35v-2.65H8.2a2.3 2.3 0 0 1-2.3-2.3V8.8a2.3 2.3 0 0 1 2.3-2.3Z"
      />
      <circle cx="9.4" cy="11.1" r="0.8" fill="#0D9488" />
      <circle cx="12" cy="11.1" r="0.8" fill="#0D9488" />
      <circle cx="14.6" cy="11.1" r="0.8" fill="#0D9488" />
    </svg>
  );
}

export function StudioLogoColor({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <circle cx="12" cy="12" r="12" fill="#EA580C" />
      <rect x="5.2" y="6.6" width="11.6" height="9.4" rx="1.6" fill="#FFFFFF" />
      <path d="M6.8 14.4 9.6 11l2 2.2 1.1-1.2 1.7 2.4Z" fill="#EA580C" />
      <circle cx="13.6" cy="9.1" r="1" fill="#EA580C" />
      <circle cx="16.6" cy="16.2" r="4" fill="#EA580C" />
      <circle cx="16.6" cy="16.2" r="3" fill="#FFFFFF" />
      <path d="M15.6 14.6 18.2 16.2 15.6 17.8Z" fill="#EA580C" />
    </svg>
  );
}

const CHANNELS_WITH_MARKS = new Set([
  "whatsapp",
  "unofficial_whatsapp",
  "instagram",
  "facebook",
  "telegram",
  "webchat",
]);

export function hasChannelMark(channel: string | null | undefined): boolean {
  return CHANNELS_WITH_MARKS.has(channel ?? "");
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  unofficial_whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Messenger",
  telegram: "Telegram",
  webchat: "WebChat",
};

export function channelLabel(channel: string | null | undefined): string | null {
  return CHANNEL_LABELS[channel ?? ""] ?? null;
}

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
    case "facebook":
      return <FacebookMessengerLogoColor className={className} />;
    case "whatsapp":
      return <WhatsAppLogoColor className={className} />;
    case "telegram":
      return <TelegramLogoColor className={className} />;
    case "webchat":
      return <WebchatLogoColor className={className} />;
    case "unofficial_whatsapp":
      return <WhatsAppUnofficialLogo className={className} />;
    default:
      return null;
  }
}
