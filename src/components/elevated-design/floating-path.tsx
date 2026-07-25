"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WaveItem {
  id: string;
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  color: string;
  strokeWidth: number;
  opacity: number;
  yOffset: number;
}

const colors = [
  "stroke-black/30",
  "stroke-black/40",
  "stroke-black/20",
  "stroke-white/40",
  "stroke-white/50",
  "stroke-white/30",
  "stroke-gray-400/40",
  "stroke-gray-600/30",
];

type AdvancedPathProps = {
  renderAfterHero?: boolean;
  className?: string;
  lineOpacity?: number;
};

export default function FloatingPathsAdvanced({
  renderAfterHero,
  className = "",
  lineOpacity,
}: AdvancedPathProps) {
  const [waves, setWaves] = useState<WaveItem[]>([]);
  const [time, setTime] = useState(0);
  const [show, setShow] = useState(!renderAfterHero);

  useEffect(() => {
    const initialWaves: WaveItem[] = [];
    for (let i = 0; i < 8; i++) {
      initialWaves.push({
        id: `wave-${i}`,
        amplitude: Math.random() * 40 + 20,
        frequency: Math.random() * 0.008 + 0.002,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
        color: colors[Math.floor(Math.random() * colors.length)],
        strokeWidth: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.2,
        yOffset: Math.random() * window.innerHeight,
      });
    }
    setWaves(initialWaves);
  }, []);

  useEffect(() => {
    const animate = () => {
      setTime((prevTime) => prevTime + 1);
      requestAnimationFrame(animate);
    };
    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    if (!renderAfterHero) return;
    const onScroll = () => {
      if (window.scrollY >= window.innerHeight / 2) {
        setShow(true);
      } else {
        setShow(false);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [renderAfterHero]);

  const generateWavePath = (wave: WaveItem) => {
    const points: string[] = [];
    const width = window.innerWidth + 200;
    const step = 4;
    for (let x = -100; x <= width; x += step) {
      const y =
        wave.yOffset +
        wave.amplitude *
          Math.sin(wave.frequency * x + wave.phase + time * wave.speed);
      if (x === -100) {
        points.push(`M ${x} ${y}`);
      } else {
        points.push(`L ${x} ${y}`);
      }
    }
    return points.join(" ");
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            type: "tween" as const,
            duration: 1.2,
            ease: "easeInOut" as const,
          }}
        >
          <svg className="absolute inset-0 w-full h-full">
            {waves.map((wave) => (
              <motion.path
                key={wave.id}
                d={generateWavePath(wave)}
                fill="none"
                stroke="currentColor"
                strokeWidth={wave.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={wave.color}
                style={{
                  opacity: lineOpacity ?? wave.opacity,
                  filter: `drop-shadow(0 0 ${
                    wave.strokeWidth * 2
                  }px currentColor)`,
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

            {waves.slice(0, 4).map((wave, index) => (
              <motion.path
                key={`wave-layer-${wave.id}`}
                d={generateWavePath({
                  ...wave,
                  amplitude: wave.amplitude * 0.6,
                  frequency: wave.frequency * 1.5,
                  phase: wave.phase + Math.PI / 4,
                  yOffset: wave.yOffset + 30,
                  speed: wave.speed * 0.8,
                })}
                fill="none"
                stroke="currentColor"
                strokeWidth={wave.strokeWidth * 0.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={wave.color}
                style={{
                  opacity: (lineOpacity ?? wave.opacity) * 0.5,
                  filter: `drop-shadow(0 0 ${wave.strokeWidth}px currentColor)`,
                }}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  type: "tween" as const,
                  duration: 2.5,
                  delay: index * 0.2,
                  ease: "easeInOut" as const,
                }}
              />
            ))}

            {waves.slice(4, 6).map((wave, index) => (
              <motion.path
                key={`bg-wave-${wave.id}`}
                d={generateWavePath({
                  ...wave,
                  amplitude: wave.amplitude * 1.8,
                  frequency: wave.frequency * 0.3,
                  phase: wave.phase + Math.PI,
                  speed: wave.speed * 0.4,
                })}
                fill="none"
                stroke="currentColor"
                strokeWidth={wave.strokeWidth * 0.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-gray-300/20"
                style={{
                  opacity: lineOpacity ?? 0.15,
                }}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  type: "tween" as const,
                  duration: 3,
                  delay: index * 0.5,
                  ease: "easeInOut" as const,
                }}
              />
            ))}
          </svg>

          {waves.slice(0, 3).map((wave, index) => (
            <motion.div
              key={`particle-${wave.id}`}
              className="absolute w-2 h-2 rounded-full bg-white/30"
              style={{
                left: `${
                  (time * wave.speed * 50) % (window.innerWidth + 100)
                }px`,
                top: `${
                  wave.yOffset +
                  wave.amplitude *
                    Math.sin(
                      wave.frequency * (time * wave.speed * 50) + wave.phase,
                    )
                }px`,
                filter: "blur(0.5px)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 4,
                type: "tween" as const,
                repeat: Number.POSITIVE_INFINITY,
                delay: index * 1.5,
                ease: "easeInOut" as const,
              }}
            />
          ))}

          {waves.slice(0, 2).map((wave, index) => {
            const nextWave = waves[index + 1];
            if (!nextWave) return null;

            const intersectionX = (time * 2) % window.innerWidth;
            const y1 =
              wave.yOffset +
              wave.amplitude *
                Math.sin(
                  wave.frequency * intersectionX +
                    wave.phase +
                    time * wave.speed,
                );
            const y2 =
              nextWave.yOffset +
              nextWave.amplitude *
                Math.sin(
                  nextWave.frequency * intersectionX +
                    nextWave.phase +
                    time * nextWave.speed,
                );

            return (
              <motion.div
                key={`intersection-${wave.id}-${nextWave.id}`}
                className="absolute w-1 h-1 rounded-full bg-white/50"
                style={{
                  left: `${intersectionX}px`,
                  top: `${(y1 + y2) / 2}px`,
                  filter: "blur(0.2px)",
                }}
                animate={{
                  scale: [0.5, 1.5, 0.5],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  type: "tween" as const,
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut" as const,
                }}
              />
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
