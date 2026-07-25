"use client";

import { ChatCircle, Envelope } from "@phosphor-icons/react";

import type { Icon } from "@phosphor-icons/react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { getBrand } from "@/config/brand";
import { useTranslations } from "next-intl";

type ContactChannel = { icon: Icon; labelKey: string; value: string };

export default function Footer() {
  const t = useTranslations("footerMain");
  const brand = getBrand();
  const currentYear = new Date().getFullYear();

  const contactChannels: ContactChannel[] = [
    { icon: Envelope, labelKey: "email", value: brand.contactEmail },
    { icon: ChatCircle, labelKey: "whatsapp", value: brand.phone },
  ];

  const documents = [
    { label: "CNPJ", value: brand.cnpj },
    { label: "Razão Social", value: brand.legalName },
  ];

  return (
    <footer className="relative bg-[#0b0d12] text-white/70">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-14 sm:px-6 lg:px-8 xl:px-10">
        <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.8fr)_repeat(2,minmax(0,1fr))]">
          {/* Brand */}
          <div className="min-w-0 max-w-md space-y-5">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src={brand.logo.markWhite}
                alt={brand.name}
                width={120}
                height={60}
                style={{ height: "auto" }}
                className="object-contain"
              />
            </Link>
            <p className="text-sm leading-relaxed text-white/55">
              {t("description")}
            </p>
          </div>

          {/* Contact + Documentation */}
          <div className="min-w-0 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {t("contactTitle")}
            </h4>
            <ul className="space-y-2.5 text-sm">
              {contactChannels.map((channel) => (
                <li key={channel.labelKey} className="flex items-center gap-2.5">
                  <channel.icon weight="bold" className="h-4 w-4 text-primary" />
                  <span className="min-w-0 break-all text-white/60">
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
                    className="text-white/60 transition-colors hover:text-primary"
                  >
                    {t("quickLinks.documentation")}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Legal / documents */}
          <div className="min-w-0 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
              {t("documentsTitle")}
            </h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              {documents.map((doc) => (
                <li key={doc.label} className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-white/40">
                    {doc.label}
                  </span>
                  <span className="min-w-0 break-words text-white/70">
                    {doc.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      <div className="border-t border-white/10 py-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-4 px-4 text-center text-xs text-white/45 sm:px-6 lg:px-8 xl:px-10 md:flex-row md:text-left">
          <p className="min-w-0">{t("copyright", { year: currentYear })}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-end">
            <Link
              href="/terms-of-service"
              className="transition-colors hover:text-primary"
            >
              {t("termsOfUse")}
            </Link>
            <Link
              href="/privacy-policy"
              className="transition-colors hover:text-primary"
            >
              {t("privacyPolicy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
