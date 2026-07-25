"use client";

import { ArrowUpRight, Check, Fire } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface PricingCardProps {
  planName: string;
  monthlyPrice: string;
  yearlyPrice: string;
  planDescription: string;
  features: string[];
  isYearly?: boolean;
  buttonText?: string;
  buttonVariant?: "primary" | "secondary";
  onButtonClick?: () => void;
  showPopularTag?: boolean;
  className?: string;
}

export function PricingCard({
  planName,
  monthlyPrice,
  yearlyPrice,
  planDescription,
  features,
  isYearly = false,
  buttonText = "Get Started",
  buttonVariant = "secondary",
  onButtonClick,
  showPopularTag = false,
  className = "",
}: PricingCardProps) {
  const currentPrice = isYearly ? yearlyPrice : monthlyPrice;
  const billingLabel = isYearly ? "/year" : "/month";

  return (
    <motion.div
      className={`relative w-full max-w-[440px] min-w-[280px] bg-[rgb(245,245,245)] rounded-2xl p-8 shadow-[0px_0.7px_0.7px_-0.67px_rgba(0,0,0,0.08),0px_1.8px_1.8px_-1.33px_rgba(0,0,0,0.08),0px_3.6px_3.6px_-2px_rgba(0,0,0,0.07),0px_6.9px_6.9px_-2.67px_rgba(0,0,0,0.07),0px_13.6px_13.6px_-3.33px_rgba(0,0,0,0.05),0px_30px_30px_-4px_rgba(0,0,0,0.02)] border-[3px] border-white border-inset ${className}`}
      initial={{ opacity: 0, y: 70 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 1.4,
        delay: 0.2,
        type: "spring" as const,
        bounce: 0.2,
      }}
    >
      <div className="absolute top-0 right-0 w-[437px] h-[306px] opacity-10 pointer-events-none bg-gradient-radial from-[rgba(184,199,217,0.5)] to-transparent" />

      <div className="flex items-center justify-start gap-2 mb-6">
        <h3 className="text-xl font-semibold text-black">{planName}</h3>
        {showPopularTag && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-b from-black to-card rounded-full border-[rgba(216,231,242,0.07)] shadow-[0px_0.7px_0.7px_-0.67px_rgba(0,0,0,0.16),0px_1.8px_1.8px_-1.33px_rgba(0,0,0,0.15),0px_3.6px_3.6px_-2px_rgba(0,0,0,0.15),0px_6.9px_6.9px_-2.67px_rgba(0,0,0,0.13),0px_13.6px_13.6px_-3.33px_rgba(0,0,0,0.11),0px_30px_30px_-4px_rgba(0,0,0,0.04)]">
            <Fire className="w-5 h-5 text-white" weight="fill" />
            <span className="text-sm font-medium text-white">Popular</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-6">
        <span className="text-4xl font-bold text-black">{currentPrice}</span>
        <span className="text-base text-black opacity-80">{billingLabel}</span>
      </div>

      <p className="text-base text-black opacity-80 mb-6 text-left">
        {planDescription}
      </p>

      <Button
        onClick={onButtonClick}
        className={`w-full h-[46px] mb-6 ${
          buttonVariant === "primary"
            ? "bg-black text-white hover:bg-foreground/90"
            : "bg-card text-black border border-foreground/20 hover:bg-muted"
        }`}
      >
        {buttonText}
        <ArrowUpRight className="w-4 h-4 ml-2" weight="bold" />
      </Button>

      <div className="w-full h-0.5 bg-black opacity-40 rounded-lg border-dotted border-[3px] border-[rgba(0,0,0,0.4)] mb-6" />

      <div className="space-y-4">
        {features
          .filter((feature) => feature.trim())
          .map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <Check
                className="w-4 h-4 text-black opacity-50 flex-shrink-0"
                weight="fill"
              />
              <span className="text-base text-black opacity-80 text-left">
                {feature}
              </span>
            </div>
          ))}
      </div>
    </motion.div>
  );
}
