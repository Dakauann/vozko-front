"use client";

import type { MonthlyYearlyTabProps } from "../../types/pricing";
import type React from "react";
import type { Variants } from "framer-motion";
import { motion } from "framer-motion";

const MonthlyYearlyTab: React.FC<MonthlyYearlyTabProps> = ({
  variant = "monthly",
  onMonthlyClick,
  onYearlyClick,
  discount = "30% off",
  className = "",
}) => {
  const tabVariants: Variants = {
    initial: { opacity: 0, y: 70 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        bounce: 0.2,
        delay: 0,
        duration: 0.4,
        type: "spring" as const,
      },
    },
  };

  return (
    <motion.div
      className={`
        relative flex items-center justify-center overflow-hidden
        bg-[rgb(245,245,245)] rounded-[34px] w-[284px] h-[55px] pl-2
        ${className}
      `}
      style={{
        boxShadow: `
          0px 0.7065919983928324px 0.7065919983928324px -0.6666666666666666px rgba(0, 0, 0, 0.08),
          0px 1.8065619053231785px 1.8065619053231785px -1.3333333333333333px rgba(0, 0, 0, 0.08),
          0px 3.6217592146567767px 3.6217592146567767px -2px rgba(0, 0, 0, 0.07),
          0px 6.8655999097303715px 6.8655999097303715px -2.6666666666666665px rgba(0, 0, 0, 0.07),
          0px 13.646761411524492px 13.646761411524492px -3.3333333333333335px rgba(0, 0, 0, 0.05),
          0px 30px 30px -4px rgba(0, 0, 0, 0.02)
        `,
      }}
      variants={tabVariants}
      initial="initial"
      animate="animate"
    >
      {}
      <button
        onClick={onMonthlyClick}
        className={`
          flex items-center justify-center px-4 py-3 rounded-full
          text-sm font-medium transition-all duration-200
          ${
            variant === "monthly"
              ? "bg-card text-black shadow-sm"
              : "text-black opacity-60 hover:opacity-80"
          }
        `}
      >
        Monthly
      </button>

      {}
      <button
        onClick={onYearlyClick}
        className={`
          flex items-center justify-center gap-1 px-4 py-3 rounded-full
          text-sm font-medium transition-all duration-200
          ${
            variant === "yearly"
              ? "bg-card text-black shadow-sm"
              : "text-black opacity-60 hover:opacity-80"
          }
        `}
      >
        Yearly
        {variant === "yearly" && (
          <span className="text-xs bg-healthy text-healthy-foreground px-1.5 py-0.5 rounded">
            {discount}
          </span>
        )}
      </button>

      {}
      <motion.div
        className="absolute bottom-0 h-0.5 bg-black z-10"
        style={{
          left: variant === "monthly" ? "21px" : "unset",
          right: variant === "yearly" ? "25px" : "unset",
          width: variant === "monthly" ? "67px" : "145px",
        }}
        layout
        transition={{ type: "spring" as const, bounce: 0.2, duration: 0.4 }}
      />
    </motion.div>
  );
};

export default MonthlyYearlyTab;
