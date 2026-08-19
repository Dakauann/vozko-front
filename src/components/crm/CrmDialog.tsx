"use client";

import { ChatCircleDots, X } from "@/components/icons";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import type { CampaignType } from "@/lib/conversations/types";
import CrmLayout, { type CrmTranslations } from "./CrmLayout";


interface CrmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignType: CampaignType;
  translations: CrmTranslations & {
    dialogTitle: string;
    dialogDescription: string;
  };
}


export default function CrmDialog({
  isOpen,
  onClose,
  campaignId,
  campaignType,
  translations: t,
}: CrmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog panel */}
          <motion.div
            className="fixed inset-0 z-10 flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
          >
            <div className="flex h-full flex-col overflow-hidden bg-card">
              {/* ── Header ─────────────────────────────── */}
              <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3.5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[--radius] bg-healthy/100">
                    <ChatCircleDots
                      weight="fill"
                      className="h-4.5 w-4.5 text-white"
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {t.dialogTitle}
                    </h2>
                    <p className="text-2xs text-muted-foreground">
                      {t.dialogDescription}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-card text-muted-foreground transition-colors duration-150 hover:bg-black/5 hover:text-foreground"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>

              {/* ── CRM Body ───────────────────────────── */}
              <div className="flex-1 min-h-0">
                <CrmLayout
                  campaignId={campaignId}
                  campaignType={campaignType}
                  enabled={isOpen}
                  embedded
                  translations={t}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
