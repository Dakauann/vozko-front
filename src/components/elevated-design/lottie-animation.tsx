"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { cn } from "@/lib/utils";

export interface LottieAnimationProps {
  
  src: string;
  
  loop?: boolean;
  
  autoplay?: boolean;
  
  speed?: number;
  
  className?: string;
  
  width?: number | string;
  
  height?: number | string;
}


export function LottieAnimation({
  src,
  loop = true,
  autoplay = true,
  speed = 1,
  className,
  width,
  height,
}: LottieAnimationProps) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{ width, height }}
    >
      <DotLottieReact
        src={src}
        loop={loop}
        autoplay={autoplay}
        speed={speed}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

export default LottieAnimation;
