"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { motion } from "framer-motion";

export function AuthFormAlert({ message }: { message: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mb-6 flex items-start gap-3 text-destructive"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-white shadow-sm">
        <WarningCircle weight="fill" className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium leading-snug">{message}</p>
    </motion.div>
  );
}
