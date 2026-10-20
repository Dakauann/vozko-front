"use client";

import { useTranslations } from "next-intl";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyChords } from "@/components/crm/KeyChords";
import { CRM_SHORTCUT_NAMESPACE, SHORTCUT_SCOPES, bindingsIn, scopeLabelKey } from "@/lib/keyboard/crm-bindings";

export function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations(CRM_SHORTCUT_NAMESPACE);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {SHORTCUT_SCOPES.map((scope) => {
            const bindings = bindingsIn(scope).filter((binding) => binding.keys.length > 0);
            if (bindings.length === 0) return null;
            return (
              <section key={scope} aria-labelledby={`shortcuts-${scope}`}>
                <h3 id={`shortcuts-${scope}`} className="legend mb-1.5">
                  {t(scopeLabelKey(scope))}
                </h3>
                <dl className="flex flex-col divide-y divide-border rounded-[--radius] border border-border">
                  {bindings.map((binding) => (
                    <div key={binding.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <dt className="text-sm text-foreground">{t(binding.labelKey)}</dt>
                      <dd>
                        <KeyChords keys={binding.keys} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
