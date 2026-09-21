import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { FaqPost } from "@/components/faq/faq-post";
import { FAQ_POSTS, getFaqPost } from "@/content/faq";
import { routing } from "@/i18n/routing";

type FaqPostPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    FAQ_POSTS.map((post) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({ params }: FaqPostPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const entry = getFaqPost(slug);

  if (!entry) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: `faq.posts.${entry.key}` });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `/${locale}/faq/${entry.slug}` },
    openGraph: {
      type: "article",
      title: t("metaTitle"),
      description: t("metaDescription"),
      publishedTime: entry.publishedAt,
      modifiedTime: entry.updatedAt,
    },
  };
}

export default async function FaqPostPage({ params }: FaqPostPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const entry = getFaqPost(slug);

  if (!entry) {
    notFound();
  }

  return <FaqPost entry={entry} />;
}
