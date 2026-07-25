"use client";

import type { GradientTextProps } from "../types/gradient-text";
import type React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const GradientText: React.FC<GradientTextProps> = ({
  children,
  as = "h1",
  alignment = "left",
  gradientDirection = 25,
  startColor = "var(--token-6396e7f2-0645-4f69-9a36-80e94f8ee015, hsl(var(--foreground)))",
  endColor = "var(--token-d4c0a0e6-8fba-45bc-8f6f-215e608cd0df, hsl(var(--foreground) / 0.3))",
  startPosition = 34,
  endPosition = 124,
  className,
  containerClassName,
}) => {
  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientDirection}deg, ${startColor} ${startPosition}%, ${endColor} ${endPosition}%)`,
  };

  const alignmentStyles = {
    "--framer-text-alignment": alignment,
  } as React.CSSProperties;

  const containerStyles = cn(
    "outline-none flex flex-col justify-start flex-shrink-0",
    "transform-none",
    containerClassName,
  );

  const textStyles = cn(
    "bg-clip-text text-transparent font-bold leading-tight",

    {
      "text-2xl md:text-3xl": as === "h1",
      "text-xl md:text-2xl": as === "h2",
      "text-lg md:text-xl": as === "h3",
      "text-base md:text-lg": as === "h4",
      "text-sm md:text-base": as === "h5",
      "text-sm": as === "h6",
    },

    {
      "text-left": alignment === "left",
      "text-center": alignment === "center",
      "text-right": alignment === "right",
    },
    className,
  );

  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        type: "tween" as const,
        duration: 0.6,
        ease: "easeInOut" as const,
      },
    },
  };

  const textVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        type: "tween" as const,
        duration: 0.8,
        delay: 0.2,
        ease: "easeInOut" as const,
      },
    },
  };

  const HeadingComponent = as;

  return (
    <motion.div
      className={containerStyles}
      style={alignmentStyles}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <HeadingComponent className={textStyles}>
        <motion.span
          style={gradientStyle}
          className="bg-clip-text text-transparent"
          variants={textVariants}
        >
          {children}
        </motion.span>
      </HeadingComponent>
    </motion.div>
  );
};

export default GradientText;
