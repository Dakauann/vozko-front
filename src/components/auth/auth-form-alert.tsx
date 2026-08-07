"use client";

import { WarningCircle } from "@/components/icons";
import { motion } from "framer-motion";

export function AuthFormAlert({ message }: { message: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mb-6 flex items-start gap-3 text-destructive-ink"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-sm">
        <WarningCircle weight="fill" className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium leading-snug">{message}</p>
    </motion.div>
  );
}
