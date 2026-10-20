"use client";

import { useState } from "react";

import { Storefront } from "@/components/icons";
import { cn } from "@/lib/utils";

export function MercadoLivreListingThumb({ url, className }: { url?: string; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  const shown = url && broken !== url ? url : null;
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted", className ?? "h-10 w-10")}>
      {shown ? (
        <img src={shown} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(shown)} />
      ) : (
        <Storefront className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}
