"use client";

import { useLocale, useTranslations } from "next-intl";

import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "@/i18n/routing";
import { getBrand } from "@/config/brand";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

export default function PrivacyPolicyPage() {
  const locale = useLocale();
  const t = useTranslations("privacyPolicy");

  const sections = [
    "introduction",
    "informationWeCollect",
    "howWeUseInformation",
    "dataSharing",
    "dataSecurity",
    "dataRetention",
    "yourRights",
    "cookies",
    "thirdPartyLinks",
    "childrenPrivacy",
    "lawfulBasis",
    "internationalTransfers",
    "whatsappPlatform",
    "messagingConsent",
    "contactUs",
    "googleApiServices",
  ];

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full min-h-screen bg-gradient-to-b from-muted to-card"
    >
      <motion.div
        variants={itemVariants}
        className="w-full border-b border-border bg-card"
      >
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft weight="bold" className="h-4 w-4" />
            {t("backHome")}
          </Link>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="w-full border-b border-border bg-card py-12"
      >
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("lastUpdated", {
              date: new Date().toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            })}
          </p>
        </div>
      </motion.div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <motion.div
            variants={itemVariants}
            className="lg:col-span-1 lg:sticky lg:top-8 h-fit"
          >
            <div className="rounded-lg bg-muted p-6 border border-border">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                {t("tableOfContents")}
              </h2>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <a
                    key={section}
                    href={`#${section}`}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t(`sections.${section}.title`)}
                  </a>
                ))}
              </nav>
            </div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-3 space-y-12"
          >
            {sections.map((section) => (
              <motion.section
                key={section}
                variants={itemVariants}
                id={section}
                className="scroll-mt-8"
              >
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  {t(`sections.${section}.title`)}
                </h2>
                <div className="prose prose-sm max-w-none text-foreground space-y-4">
                  {(() => {
                    const content = t(`sections.${section}.content`);
                    const paragraphs = content.split("\n\n");
                    return paragraphs.map((paragraph, idx) => (
                      <p key={idx} className="text-foreground leading-relaxed">
                        {paragraph}
                      </p>
                    ));
                  })()}

                  {t.has(`sections.${section}.items`) && (
                    <ul className="list-disc pl-6 space-y-2">
                      {(() => {
                        const itemsString = t(`sections.${section}.items`);
                        return itemsString
                          .split("\n")
                          .filter(Boolean)
                          .map((item, idx) => (
                            <li key={idx} className="text-foreground">
                              {item}
                            </li>
                          ));
                      })()}
                    </ul>
                  )}
                </div>
              </motion.section>
            ))}
          </motion.div>
        </div>

        <motion.div
          variants={itemVariants}
          className="mt-16 pt-8 border-t border-border"
        >
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-6">
              {t("questions")}
            </p>
            <a
              href={`mailto:${getBrand().supportEmail}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-white rounded-lg font-semibold hover:bg-foreground/90 transition-colors"
            >
              {t("contactUs")}
            </a>
          </div>
        </motion.div>
      </div>
    </motion.main>
  );
}
