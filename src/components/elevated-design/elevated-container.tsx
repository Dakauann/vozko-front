"use client";

import { motion } from "framer-motion";
import React, { type ElementType, useEffect, useMemo, useState } from "react";

export interface ElevatedContainerProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  as?: ElementType;
  animatedBackground?: boolean;
  backgroundLineColor?: string;
  backgroundOpacity?: number;
  accentGlow?: boolean;
  accentSeed?: string | number;
  accentGlowOpacity?: number;
  accentGlowClassName?: string;
  contentClassName?: string;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildAccentGradient(seed: string) {
  const hash = hashSeed(seed);
  const baseHue = hash % 360;
  const hueShift = (hash % 45) + 20;
  const saturation = 75 + (hash % 20);
  const lightness = 50 + (hash % 10);

  const colorA = `hsla(${baseHue}, ${saturation}%, ${lightness}%, 0.85)`;
  const colorB = `hsla(${(baseHue + hueShift) % 360}, ${Math.min(
    saturation + 8,
    98,
  )}%, ${Math.max(lightness - 8, 38)}%, 0.95)`;
  const colorC = `hsla(${
    (baseHue + Math.floor(hueShift * 1.6)) % 360
  }, ${Math.min(saturation + 12, 100)}%, ${Math.min(lightness + 6, 78)}%, 0.9)`;

  return {
    background: `linear-gradient(130deg, ${colorA} 0%, ${colorB} 48%, ${colorC} 100%)`,
  } as React.CSSProperties;
}

interface WaveItem {
  id: string;
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  strokeWidth: number;
  yOffset: number;
}

export default function ElevatedContainer({
  children,
  className = "",
  as: Component = "div",
  animatedBackground = false,
  backgroundLineColor = "rgb(0,0,0)",
  backgroundOpacity = 0.8,
  accentGlow = false,
  accentSeed,
  accentGlowOpacity = 0.85,
  accentGlowClassName = "pointer-events-none absolute inset-x-6 top-6 h-32 rounded-[32px] blur-2xl transition-opacity duration-500 group-hover:opacity-100",
  contentClassName = "",
  ...rest
}: ElevatedContainerProps) {
  const [waves, setWaves] = useState<WaveItem[]>([]);
  const [time, setTime] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animatedBackground) return;

    const initialWaves: WaveItem[] = [];
    for (let i = 0; i < 4; i++) {
      initialWaves.push({
        id: `wave-${i}`,
        amplitude: Math.random() * 20 + 10,
        frequency: Math.random() * 0.008 + 0.002,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
        strokeWidth: Math.random() * 1.5 + 1,
        yOffset: Math.random() * (containerSize.height || 0),
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaves(initialWaves);
  }, [animatedBackground, containerSize]);

  useEffect(() => {
    if (!animatedBackground) return;

    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateContainerSize();
    window.addEventListener("resize", updateContainerSize);

    const animate = () => {
      setTime((t) => t + 1);
      requestAnimationFrame(animate);
    };
    const animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", updateContainerSize);
      cancelAnimationFrame(animationId);
    };
  }, [animatedBackground]);

  const generateWavePath = (wave: WaveItem) => {
    if (!containerSize.width || !containerSize.height) return "";

    const points: string[] = [];
    const width = containerSize.width;
    const step = 4;

    for (let x = 0; x <= width; x += step) {
      const y =
        wave.yOffset +
        wave.amplitude *
          Math.sin(wave.frequency * x + wave.phase + time * wave.speed);
      if (x === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        points.push(`L ${x} ${y}`);
      }
    }
    return points.join(" ");
  };

  const accentStyle = useMemo(() => {
    if (!accentGlow) {
      return null;
    }

    const resolvedSeed = String(accentSeed ?? "elevated-container-accent");
    return buildAccentGradient(resolvedSeed);
  }, [accentGlow, accentSeed]);

  const Wrapper = Component as React.FC<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLDivElement> }
  >;

  return (
    <Wrapper
      ref={containerRef}
      className={`rounded-[--radius] p-6 relative overflow-hidden border border-border bg-card transition-all duration-300 ${className}`}
      style={{
        boxShadow:
          "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)",
        ...(rest.style || {}),
      }}
      {...rest}
    >
      {accentGlow && accentStyle ? (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div
            className={accentGlowClassName}
            style={{
              ...accentStyle,
              opacity: accentGlowOpacity,
            }}
            aria-hidden="true"
          />
        </div>
      ) : null}
      {animatedBackground && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg className="absolute inset-0 w-full h-full">
            {waves.map((wave) => (
              <motion.path
                key={wave.id}
                d={generateWavePath(wave)}
                fill="none"
                stroke={backgroundLineColor}
                strokeWidth={wave.strokeWidth * 50}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  opacity: backgroundOpacity,
                }}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  type: "tween" as const,
                  duration: 2,
                  ease: "easeInOut" as const,
                }}
              />
            ))}
          </svg>
        </div>
      )}
      <div className={`relative z-10 ${contentClassName}`}>{children}</div>
    </Wrapper>
  );
}
