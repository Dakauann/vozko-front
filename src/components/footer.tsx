"use client";

import { ChatCircle, Envelope } from "@/components/icons";
import { BrandLogo } from "@/components/brand-logo";

import type { Icon } from "@/components/icons";
import { Link } from "@/i18n/routing";
import { getBrand } from "@/config/brand";
import { useTranslations } from "next-intl";

type ContactChannel = { icon: Icon; labelKey: string; value: string };

/**
 * Public footer, in the panel's own vocabulary.
 *
 * This was a near-black slab (`bg-[#0b0d12]`, `text-white/70`) bolted under a
 * light product — a second visual world living below the fold, and the one part
 * of the public surface that ignored the theme entirely. It is now the same
 * panel as everything above it: engraved rules instead of a colour change,
 * silkscreen legends over their values, and registry identifiers set as
 * readouts, because a CNPJ is a number someone copies, not prose.
 */
export default function Footer() {
  const t = useTranslations("footerMain");
  const brand = getBrand();
  const currentYear = new Date().getFullYear();

  const contactChannels: ContactChannel[] = [
    { icon: Envelope, labelKey: "email", value: brand.contactEmail },
    { icon: ChatCircle, labelKey: "whatsapp", value: brand.phone },
  ];

  const documents = [
    { label: "CNPJ", value: brand.cnpj, readout: true },
    { label: t("legalName"), value: brand.legalName, readout: false },
  ];

  return (
    <footer className="border-t border-border bg-card text-foreground">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.8fr)_repeat(2,minmax(0,1fr))]">
          <div className="min-w-0 max-w-md space-y-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BrandLogo size="md" />
            </Link>
            <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              {t("description")}
            </p>
          </div>

          <div className="min-w-0 space-y-3">
            <h2 className="legend">{t("contactTitle")}</h2>
            <ul className="space-y-2">
              {contactChannels.map((channel) => (
                <li key={channel.labelKey} className="flex items-center gap-2">
                  <channel.icon
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-all text-sm text-foreground">
                    {channel.value}
                  </span>
                </li>
              ))}
              {brand.docsUrl && (
                <li className="pt-1">
                  <a
                    href={brand.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[--radius] text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("quickLinks.documentation")}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="min-w-0 space-y-3">
            <h2 className="legend">{t("documentsTitle")}</h2>
            <ul className="space-y-2.5">
              {documents.map((doc) => (
                <li key={doc.label} className="min-w-0">
                  <span className="legend block">{doc.label}</span>
                  <span
                    className={`mt-0.5 block min-w-0 break-words text-sm text-foreground ${
                      doc.readout ? "readout" : ""
                    }`}
                  >
                    {doc.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-3 px-4 py-4 text-center sm:px-6 lg:px-8 md:flex-row md:text-left">
          <p className="legend min-w-0">{t("copyright", { year: currentYear })}</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-end">
            <Link
              href="/terms-of-service"
              className="legend rounded-[--radius] transition-colors hover:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("termsOfUse")}
            </Link>
            <Link
              href="/privacy-policy"
              className="legend rounded-[--radius] transition-colors hover:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("privacyPolicy")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
