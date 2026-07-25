"use client";

import { Question, Envelope } from "@phosphor-icons/react";
import { motion, useInView, type Variants } from "framer-motion";
import { useRef, useState } from "react";

import Badge from "../badge";
import FAQItem from "./faq-item";
import type React from "react";
import { cn } from "@/lib/utils";

interface FAQData {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  variant?: "Desktop" | "Tablet" | "Phone";
  className?: string;
}

const faqData: FAQData[] = [
  {
    question: "What services do you offer?",
    answer:
      "We specialize in AI solutions, including machine learning models, automation, chatbots, predictive analytics, and consulting tailored to your business needs",
  },
  {
    question: "How long does it take to develop an AI solution?",
    answer:
      "Depending on the project's complexity, timelines typically range from 2 to 12 weeks. We'll provide a detailed timeline after our initial discovery call",
  },
  {
    question: "Do I need technical expertise to work with you?",
    answer:
      "No technical background is required! We handle all the complexity for you and explain every step in simple, actionable terms",
  },
  {
    question: "Is my data safe when working with your agency?",
    answer:
      "Absolutely. We follow strict data privacy protocols, comply with GDPR standards, and offer NDAs to ensure your information stays secure",
  },
  {
    question: "Can AI really help my business grow?",
    answer:
      "Yes! AI can automate tasks, enhance customer experiences, uncover insights, and open new revenue streams, and we'll show you exactly how it can work for your business.",
  },
];

const FAQSection: React.FC<FAQSectionProps> = ({
  variant = "Desktop",
  className,
}) => {
  const [openItems, setOpenItems] = useState<number[]>([0]); 
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const toggleItem = (index: number) => {
    setOpenItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const containerClasses = {
    Desktop: "w-[1200px] px-10 py-[100px]",
    Tablet: "w-[810px] px-10 py-[100px]",
    Phone: "w-[390px] px-[18px] py-20",
  };

  const faqContainerClasses = {
    Desktop: "max-w-[600px] w-[200%]",
    Tablet: "max-w-[600px] w-[200%]",
    Phone: "max-w-[600px] w-full",
  };

  const contactClasses = {
    Desktop: "flex-row gap-2",
    Tablet: "flex-row gap-2",
    Phone: "flex-col w-full",
  };

  const containerAnimation: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const headingAnimation: Variants = {
    hidden: { opacity: 0, y: 70 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        bounce: 0.2,
        duration: 0.4,
      },
    },
  };

  const faqAnimation: Variants = {
    hidden: { opacity: 0, y: 70 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        bounce: 0.2,
        duration: 1.4,
        delay: 0.2,
      },
    },
  };

  const contactAnimation: Variants = {
    hidden: { opacity: 0, y: 70 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        bounce: 0.2,
        duration: 1.6,
        delay: 0.6,
      },
    },
  };

  return (
    <motion.section
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center overflow-visible relative",
        "bg-[rgb(245,245,245)]",
        variant !== "Phone" &&
          "rounded-t-[50px] shadow-[1px_20px_30px_-12px_rgba(0,0,0,0.2)]",
        containerClasses[variant],
        className,
      )}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={containerAnimation}
    >
      <div className="flex flex-col items-center justify-start gap-11 max-w-[1200px] w-full overflow-visible relative z-[1]">
        <motion.div
          className="flex flex-col items-center justify-center gap-4 max-w-[700px] w-full overflow-visible relative"
          variants={headingAnimation}
        >
          <div className="flex-none w-auto h-auto relative">
            <Badge content="FAQS" icon={<Question size={16} weight="fill" />} />
          </div>

          <div className="flex-none h-auto w-full relative whitespace-pre-wrap break-words">
            <h2 className="text-4xl font-bold text-center w-full font-inter">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(0deg, hsl(var(--foreground)) 34%, hsl(var(--foreground) / 0.3) 124%)",
                }}
              >
                Questions? Answers!
              </span>
            </h2>
          </div>

          <div className="flex-none h-auto max-w-[500px] w-full relative whitespace-pre-wrap break-words opacity-80">
            <p className="text-sm text-black text-center leading-[1.2em] font-inter">
              Find Some quick answers to the most common questions.
            </p>
          </div>
        </motion.div>

        <div className="flex flex-col items-center justify-center gap-8 max-w-[1000px] w-full overflow-visible relative">
          <motion.div
            className={cn(
              "flex flex-col gap-4 w-full",
              faqContainerClasses[variant],
            )}
            variants={faqAnimation}
          >
            {faqData.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openItems.includes(index)}
                onToggle={() => toggleItem(index)}
                variant={variant === "Phone" ? "mobile" : "desktop"}
              />
            ))}
          </motion.div>

          <motion.div
            className={cn(
              "flex items-center justify-center min-w-min h-min overflow-hidden relative rounded-lg px-3 py-1.5",
              contactClasses[variant],
              variant === "Phone" && "text-center",
            )}
            variants={contactAnimation}
          >
            <div className="flex-none w-[25px] h-[25px] relative">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[25px] h-[25px]">
                <Envelope
                  size={25}
                  weight="fill"
                  className="text-[rgb(14,28,41)] w-full h-full"
                />
              </div>
            </div>
            <div
              className={cn(
                "flex-none h-auto relative whitespace-pre",
                variant === "Phone" &&
                  "whitespace-pre-wrap break-words w-full text-center",
              )}
            >
              <p
                className={cn(
                  "text-sm text-black/80 font-inter leading-[1.2em]",
                  variant === "Phone" && "text-center",
                )}
              >
                Feel free to mail us for any enquiries :{" "}
                <a
                  href="mailto:orbai@support.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-blue-800 underline transition-colors"
                >
                  orbai@support.com
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default FAQSection;
