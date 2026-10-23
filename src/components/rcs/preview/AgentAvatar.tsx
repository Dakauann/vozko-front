"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ACCENT_FILL } from "./palette";

export function AgentAvatar({ name, logoUrl, alt, className }: { name: string; logoUrl?: string; alt: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = name.trim().charAt(0).toUpperCase();
  if (logoUrl && failedUrl !== logoUrl) {
    return (
      <span className={cn("relative block shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/5 dark:ring-white/10", className)}>
        <Image src={logoUrl} alt={alt} fill unoptimized sizes="64px" className="object-cover" onError={() => setFailedUrl(logoUrl)} />
      </span>
    );
  }
  return (
    <span role="img" aria-label={alt} className={cn("flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", ACCENT_FILL, className)}>
      <span aria-hidden>{initial || "?"}</span>
    </span>
  );
}
