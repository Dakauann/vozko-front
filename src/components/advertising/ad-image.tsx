import Image from "next/image";

import { cn } from "@/lib/utils";

export function AdImage({ src, className }: { src: string; className?: string }) {
  return <Image src={src} alt="" fill unoptimized sizes="100vw" className={cn("object-cover", className)} />;
}
