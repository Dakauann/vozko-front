"use client";

import MonthlyYearlyTab from "./monthly-yearly-tab";
import { PricingCard } from "./pricing-card";
import type { PricingProps } from "../../types/pricing";
import type React from "react";
import { motion, type Variants } from "framer-motion";
import { useState } from "react";

const Pricing: React.FC<PricingProps> = ({
  variant = "monthly",
  className = "",
}) => {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">(
    variant === "yearly" ? "yearly" : "monthly"
  );

  const containerVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants: Variants = {
    initial: { opacity: 0, x: -70 },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        bounce: 0.2,
        duration: 1.4,
        type: "spring" as const,
      },
    },
  };

  const pricingPlans = [
    {
      planName: "Starter",
      monthlyPrice: "$800",
      yearlyPrice: "$700",
      planDescription:
        "Ideal for businesses ready to explore AI and intelligent automation",
      showPopularTag: false,
      buttonVariant: "secondary" as const,
      features: [
        "Basic AI Tools",
        "Limited Automation Features",
        "Real-Time Reporting",
        "Basic Chatbot Integration",
      ],
    },
    {
      planName: "Pro",
      monthlyPrice: "$1700",
      yearlyPrice: "$1600",
      planDescription:
        "Built for companies that want to gain an edge with AI-powered automation",
      showPopularTag: true,
      buttonVariant: "primary" as const,
      features: [
        "Advanced AI Tools",
        "Customizable Workflows",
        "AI-Powered Analytics",
        "Premium Chatbot Features",
        "Cross-Platform Integrations",
      ],
    },
    {
      planName: "Enterprise",
      monthlyPrice: "$4700",
      yearlyPrice: "$3600",
      planDescription:
        "For businesses aiming to harness AI and automation to lead their industry",
      showPopularTag: false,
      buttonVariant: "secondary" as const,
      features: [
        "Fully Customized AI Solutions",
        "Unlimited Integrations",
        "Advanced Reporting & Insights",
        "Scalable AI Solutions",
        "Team Collaboration Features",
        "Priority Feature Access",
      ],
    },
  ];

  const isMobile = variant === "mobile-v1" || variant === "mobile-v2";

  return (
    <motion.div
      className={`
        flex flex-col items-center gap-8 w-full max-w-[1120px]
        ${isMobile ? "px-4" : ""}
        ${className}
      `}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      {}
      <MonthlyYearlyTab
        variant={selectedPlan}
        onMonthlyClick={() => setSelectedPlan("monthly")}
        onYearlyClick={() => setSelectedPlan("yearly")}
        discount="30% off"
      />

      {}
      <motion.div
        className={`
          flex gap-6 w-full justify-center
          ${isMobile ? "flex-col items-center" : "flex-wrap"}
        `}
        variants={containerVariants}
      >
        {pricingPlans.map((plan, index) => (
          <motion.div
            key={plan.planName}
            variants={cardVariants}
            custom={index}
            className="flex-1 min-w-[280px] max-w-[440px]"
          >
            <PricingCard
              planName={plan.planName}
              monthlyPrice={plan.monthlyPrice}
              yearlyPrice={plan.yearlyPrice}
              planDescription={plan.planDescription}
              showPopularTag={plan.showPopularTag}
              buttonVariant={plan.buttonVariant}
              buttonText="Get Started"
              features={plan.features}
              isYearly={selectedPlan === "yearly"}
              className="w-full"
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default Pricing;
