"use client";

import { Question } from "@phosphor-icons/react";
import type React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BadgeProps {
  content?: string;
  icon?: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ content = "FAQS", icon, className }) => {
  const IconComponent = icon || <Question size={16} weight="bold" />;

  return (
    <motion.div
      className={cn(
        "inline-flex items-center justify-center gap-2 px-3 py-1.5 min-w-min h-min overflow-hidden relative",
        "rounded-full",
        "shadow-[0px_0.7065919983928324px_0.7065919983928324px_-0.5416666666666666px_rgba(0,0,0,0.1),0px_1.8065619053231785px_1.8065619053231785px_-1.0833333333333333px_rgba(0,0,0,0.09),0px_3.6217592146567767px_3.6217592146567767px_-1.625px_rgba(0,0,0,0.09),0px_6.8655999097303715px_6.8655999097303715px_-2.1666666666666665px_rgba(0,0,0,0.09),0px_13.646761411524492px_13.646761411524492px_-2.7083333333333335px_rgba(0,0,0,0.08),0px_30px_30px_-3.25px_rgba(0,0,0,0.05)]",
        "[box-shadow:inset_0px_3px_1px_0px_var(--shadow-highlight-strong)]",
        className,
      )}
      style={{
        backgroundColor: "hsl(var(--muted))",
        borderColor: "hsl(var(--muted))",
        borderWidth: "1px",
        borderStyle: "solid",
      }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <div className="flex-none w-4 h-5 relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-black/40">
          {IconComponent}
        </div>
      </div>
      <div className="flex-none h-auto relative whitespace-pre">
        <span className="text-xs font-medium text-black/40 font-inter">
          {content}
        </span>
      </div>
    </motion.div>
  );
};

export default Badge;
