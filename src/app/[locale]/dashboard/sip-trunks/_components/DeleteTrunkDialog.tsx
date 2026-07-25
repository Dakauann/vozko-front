"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash, Warning, X } from "@phosphor-icons/react";

import Button from "@/components/elevated-design/button";
import { useTranslations } from "next-intl";

interface DeleteTrunkDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  trunkName: string;
  isLoading: boolean;
}

export default function DeleteTrunkDialog({
  open,
  onClose,
  onConfirm,
  trunkName,
  isLoading,
}: DeleteTrunkDialogProps) {
  const t = useTranslations("sipTrunksPage.delete");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <Warning weight="fill" className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Excluir Tronco SIP
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Esta ação não pode ser desfeita
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground"
              >
                <X weight="bold" className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 rounded-xl bg-destructive/10 p-4">
              <p className="text-sm text-red-800">
                Você está prestes a excluir o Tronco SIP{" "}
                <strong>{trunkName}</strong>. Campanhas que usam este tronco
                irão falhar após a exclusão.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                title={t("cancel")}
                onClick={onClose}
                disabled={isLoading}
                className="text-[11px] font-semibold uppercase"
              />
              <Button
                variant="action"
                title={isLoading ? t("deleting") : t("confirm")}
                icon={<Trash weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={onConfirm}
                disabled={isLoading}
                className="bg-red-600 text-[11px] font-semibold uppercase hover:bg-red-700"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
