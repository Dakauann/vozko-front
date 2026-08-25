"use client";

import { useEffect, useState } from "react";

import type React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ChartGraphicCardProps {
  heading?: string;
  text?: string;
  variant?: "desktop-before" | "desktop-after" | "mobile";
  className?: string;
  width?: number;
  height?: number;
}

const ChartGraphicCard: React.FC<ChartGraphicCardProps> = ({
  heading = "Lead the Way",
  text = "Stay ahead with innovative web designs crafted by Arise.",
  variant = "desktop-before",
  className,
  width = 346,
  height = 334,
}) => {
  const [currentVariant, setCurrentVariant] = useState<
    "desktop-before" | "desktop-after"
  >("desktop-before");

  useEffect(() => {
    if (variant === "mobile") return;

    const timer1 = setTimeout(() => {
      setCurrentVariant("desktop-after");
    }, 3000);

    const timer2 = setTimeout(() => {
      setCurrentVariant("desktop-before");
    }, 6000);

    const interval = setInterval(() => {
      setCurrentVariant((prev) =>
        prev === "desktop-before" ? "desktop-after" : "desktop-before",
      );
    }, 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearInterval(interval);
    };
  }, [variant]);

  const isAfterPhase = currentVariant === "desktop-after";
  const isMobile = variant === "mobile";

  const transition = {
    type: "spring" as const,
    stiffness: 300,
    damping: 60,
    mass: 1,
  };

  const barHeights = {
    before: [75, 111, 146, 102], // Heights for bars in before state
    after: [75, 159, 75, 102], // Heights for bars in after state
  };

  const currentHeights = isAfterPhase ? barHeights.after : barHeights.before;

  return (
    <motion.div
      className={cn(
        "relative flex flex-col items-center justify-end overflow-hidden rounded-[--radius] bg-[rgb(245,245,245)]",
        "shadow-[0px_0.71px_0.71px_-0.67px_rgba(0,0,0,0.08),0px_1.81px_1.81px_-1.33px_rgba(0,0,0,0.08),0px_3.62px_3.62px_-2px_rgba(0,0,0,0.07),0px_6.87px_6.87px_-2.67px_rgba(0,0,0,0.07),0px_13.65px_13.65px_-3.33px_rgba(0,0,0,0.05),0px_30px_30px_-4px_rgba(0,0,0,0.02)]",
        "shadow-sm",
        isMobile ? "aspect-square" : "",
        className,
      )}
      style={{ width, height }}
      initial={false}
      animate={currentVariant}
      transition={transition}
    >
      <div className="absolute top-[-25px] left-1/2 transform -translate-x-1/2 w-[220px] h-[232px] z-10">
        {currentHeights.map((barHeight, index) => (
          <motion.div
            key={index}
            className="absolute bottom-0 w-[43px] bg-[rgb(245,245,245)] rounded-lg"
            style={{
              left: index * 59,
              boxShadow:
                "var(--elev-1)",
            }}
            animate={{ height: barHeight }}
            transition={transition}
          />
        ))}
      </div>

      <div
        className={cn(
          "relative w-full flex flex-col items-center gap-2 p-8",
          isMobile ? "gap-1 p-6" : "gap-2 p-8",
        )}
      >
        <h3 className="font-display text-xl font-semibold tracking-[0.01em] text-black text-center leading-tight">
          {heading}
        </h3>
        <p className="text-sm text-black/80 text-center leading-relaxed">
          {text}
        </p>
      </div>

      <motion.div
        className="absolute flex items-center justify-center gap-6 px-4 py-1 bg-[rgb(245,245,245)] rounded-full"
        style={{
          boxShadow:
            "var(--elev-1)",
        }}
        animate={{
          left: isAfterPhase ? 79 : 79,
          top: isAfterPhase ? 15 : 65,
        }}
        transition={transition}
      >
        <span className="text-xs font-medium text-black whitespace-nowrap z-10">
          {isAfterPhase ? "80% Automation" : "20% Automation"}
        </span>
      </motion.div>

      <motion.div
        className="absolute flex items-center justify-center gap-6 px-4 py-1 bg-[rgb(245,245,245)] rounded-full"
        style={{
          boxShadow:
            "var(--elev-1)",
        }}
        animate={{
          right: 31,
          top: isAfterPhase ? 100 : 30,
        }}
        transition={transition}
      >
        <span className="text-xs font-medium text-black whitespace-nowrap z-10">
          {isAfterPhase ? "10% Cost" : "60% Cost"}
        </span>
      </motion.div>

      {!isMobile && (
        <motion.div
          className="absolute flex items-center justify-center gap-6 px-2.5 py-3 bg-[rgb(245,245,245)] rounded-[5px] min-h-[14px] min-w-[91px] overflow-hidden"
          style={{
            left: -13,
            top: "49%",
            transform: "translateY(-50%) rotate(-90deg)",
            boxShadow:
              "var(--elev-1)",
          }}
        >
          <motion.span
            className="absolute text-xs font-medium text-black whitespace-nowrap z-10"
            animate={{
              right: isAfterPhase ? 102 : 23,
              top: "50%",
              transform: "translateY(-50%)",
            }}
            transition={transition}
          >
            BEFORE
          </motion.span>
          <motion.span
            className="absolute text-xs font-medium text-black whitespace-nowrap z-10"
            animate={{
              right: isAfterPhase ? 27 : -44,
              top: "50%",
              transform: "translateY(-50%)",
            }}
            transition={transition}
          >
            AFTER
          </motion.span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ChartGraphicCard;
