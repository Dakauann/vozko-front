"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { CaretDown, ChatText, Hash, Info, Phone, User } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import TemplateBubble from "@/components/crm/TemplateBubble";
import type { ActiveConversation, EntryTemplateInfo, TemplateMessageMetadata } from "@/lib/conversations/types";
import { panelSettleTransition, stateTransition } from "@/lib/motion/tokens";

function templateMetadataOf(templateInfo: EntryTemplateInfo | undefined): TemplateMessageMetadata | null {
  if (!templateInfo) return null;
  return {
    template_name: templateInfo.template_name,
    language: templateInfo.language,
    category: templateInfo.category,
    components: templateInfo.components,
    header_media_url: templateInfo.header_media_url,
  };
}

function ContactLine({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xs font-medium  text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground truncate">{value || <EmptyValue />}</p>
      </div>
    </div>
  );
}

export function EntryMetadataPanel({ conversation }: { conversation: ActiveConversation }) {
  const t = useTranslations("crmConversation.thread.contact");
  const [open, setOpen] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  const variables = conversation.entry_variables ?? [];
  const hasVariables = variables.length > 0;
  const templateInfo = conversation.lead_metadata?.template_info as EntryTemplateInfo | undefined;

  if (!hasVariables && !templateInfo) return null;

  const templateMetadata = templateMetadataOf(templateInfo);

  return (
    <div className="flex justify-center pb-2 pt-1">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-[--radius] bg-card px-4 py-2.5 shadow-sm transition-colors hover:bg-card"
        >
          <div className="flex items-center gap-2">
            <Info weight="fill" className="h-4 w-4 text-primary-ink" />
            <span className="text-xs font-semibold text-foreground">{t("title")}</span>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={stateTransition}>
            <CaretDown weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={panelSettleTransition}
              className="overflow-hidden"
            >
              <div className="mt-1 rounded-[--radius] bg-card px-4 py-3 shadow-sm space-y-2.5">
                <ContactLine
                  icon={<User weight="fill" className="h-3.5 w-3.5 text-muted-foreground" />}
                  label={t("name")}
                  value={conversation.lead_name}
                />
                <ContactLine
                  icon={<Phone weight="fill" className="h-3.5 w-3.5 text-muted-foreground" />}
                  label={t("phone")}
                  value={conversation.lead_number}
                />

                {hasVariables && (
                  <div className="border-t border-border pt-2">
                    <p className="text-2xs font-medium  text-muted-foreground mb-1.5">{t("variables")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {variables.map((v, i) => (
                        <span
                          key={`${i}-${v}`}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-2xs font-medium text-primary-foreground"
                        >
                          <Hash weight="bold" className="h-3 w-3 text-info-ink" />
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {templateInfo && (
                  <div className="border-t border-border pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplate(!showTemplate)}
                      className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2 transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <ChatText weight="fill" className="h-4 w-4 text-healthy" />
                        <span className="text-2xs font-semibold text-foreground">
                          {t("templateSent", { name: templateInfo.template_name })}
                        </span>
                      </div>
                      <motion.div animate={{ rotate: showTemplate ? 180 : 0 }} transition={stateTransition}>
                        <CaretDown weight="bold" className="h-3 w-3 text-muted-foreground" />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {showTemplate && templateMetadata && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={panelSettleTransition}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 flex justify-center">
                            <TemplateBubble metadata={templateMetadata} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="border-t border-border pt-2">
                  <p className="text-2xs text-muted-foreground font-mono truncate">ID: {conversation.entry_id}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
