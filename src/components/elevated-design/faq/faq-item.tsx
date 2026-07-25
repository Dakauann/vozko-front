"use client";

import { AnimatePresence, motion } from "framer-motion";

import { CaretDown } from "@phosphor-icons/react";
import type React from "react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen?: boolean;
  onToggle?: () => void;
  variant?: "desktop" | "mobile";
}

const FAQItem: React.FC<FAQItemProps> = ({
  question,
  answer,
  isOpen = false,
  onToggle,
  variant = "desktop",
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = onToggle !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <motion.div
      className={cn(
        "w-full cursor-pointer overflow-hidden",
        "rounded-[10px]",
        "shadow-[0px_0.7065919983928324px_0.7065919983928324px_-0.6666666666666666px_rgba(0,0,0,0.08),0px_1.8065619053231785px_1.8065619053231785px_-1.3333333333333333px_rgba(0,0,0,0.08),0px_3.6217592146567767px_3.6217592146567767px_-2px_rgba(0,0,0,0.07),0px_6.8655999097303715px_6.8655999097303715px_-2.6666666666666665px_rgba(0,0,0,0.07),0px_13.646761411524492px_13.646761411524492px_-3.3333333333333335px_rgba(0,0,0,0.05),0px_30px_30px_-4px_rgba(0,0,0,0.02)]",
        "[box-shadow:inset_0px_3px_1px_0px_var(--shadow-highlight-strong)]",
      )}
      style={{
        backgroundColor: "hsl(var(--muted))",
      }}
      initial={false}
      animate={{
        backgroundColor: open ? "hsl(var(--card))" : "hsl(var(--muted))",
      }}
      transition={{
        damping: 60,
        delay: 0,
        mass: 1,
        stiffness: 500,
        type: "spring",
      }}
      onClick={handleToggle}
    >
      {}
      <div className="flex items-center justify-center gap-[10px] px-4 py-3">
        <div className="flex-1 text-left">
          <p className="text-sm font-normal text-black leading-[1.2em] font-inter">
            {question}
          </p>
        </div>
        <div className="flex-none w-5 h-5 overflow-hidden relative">
          <motion.div
            className="flex-none w-5 h-5 absolute left-0 top-0 overflow-visible"
            style={{ rotate: 0 }}
            animate={{
              rotate: open ? -180 : 0,
            }}
            transition={{
              damping: 60,
              delay: 0,
              mass: 1,
              stiffness: 500,
              type: "spring",
            }}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5">
              <CaretDown
                size={20}
                weight="bold"
                className="text-black w-full h-full"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{
              height: 0,
              opacity: 0,
              filter: "blur(5px)",
            }}
            animate={{
              height: "auto",
              opacity: 0.8,
              filter: "blur(0px)",
            }}
            exit={{
              height: 0,
              opacity: 0,
              filter: "blur(5px)",
            }}
            transition={{
              damping: 60,
              delay: 0,
              mass: 1,
              stiffness: 500,
              type: "spring",
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0">
              <p className="text-sm font-normal text-black leading-[1.2em] font-inter">
                {answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {}
      <div
        className="absolute left-0 top-0 w-[437px] h-[306px] overflow-hidden pointer-events-none z-[1] opacity-10"
        style={{
          background:
            "radial-gradient(50% 50% at 7.199999999999999% 6.1%, rgba(184, 199, 217, 0.5) 0%, rgba(4, 7, 13, 0) 100%)",
        }}
      />
    </motion.div>
  );
};

export default FAQItem;
