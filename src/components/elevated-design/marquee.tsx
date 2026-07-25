"use client";

import type React from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  speed?: "slow" | "normal" | "fast";
}

export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = false,
  speed = "normal",
}: MarqueeProps) {
  const speedMap = {
    slow: "60s",
    normal: "40s",
    fast: "20s",
  };

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <div
        className={cn(
          "flex gap-4",
          reverse ? "animate-marquee-reverse" : "animate-marquee",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
        style={{
          animationDuration: speedMap[speed],
        }}
      >
        {}
        <div className="flex shrink-0 gap-4 min-w-full justify-around">
          {children}
        </div>
        {}
        <div className="flex shrink-0 gap-4 min-w-full justify-around">
          {children}
        </div>
      </div>
    </div>
  );
}
