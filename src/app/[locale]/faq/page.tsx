import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FaqIndex } from "@/components/faq/faq-index";
import { routing } from "@/i18n/routing";

type FaqIndexPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: FaqIndexPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq.index" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `/${locale}/faq` },
  };
}

export default async function FaqIndexPage({ params }: FaqIndexPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FaqIndex />;
}
