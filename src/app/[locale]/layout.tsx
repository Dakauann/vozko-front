import { getMessages, setRequestLocale } from "next-intl/server";

import { AuthProvider } from "@/contexts/auth-context";
import { LayoutWrapper } from "@/components/layout-wrapper";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import PageRevealOverlay from "@/components/elevated-design/page-reveal-overlay";
import { QueryClientProviderComponent } from "@/components/providers/query-client-provider";
import { ViewportIntegrityProvider } from "@/components/providers/viewport-integrity";
import { RefCapture } from "@/components/affiliate/ref-capture";
import { Toaster as SonnerToaster } from "sonner";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getBrand } from "@/config/brand";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = await getMessages({ locale });

  const metadata = messages.metadata as
    | { title?: string; description?: string }
    | undefined;

  const brand = getBrand();
  return {
    title: metadata?.title || brand.legalName,
    description: metadata?.description || brand.legalName,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryClientProviderComponent>
        <AuthProvider>
          <ViewportIntegrityProvider>
            <Suspense fallback={null}>
              <RefCapture />
            </Suspense>
            <PageRevealOverlay />
            <LayoutWrapper>{children}</LayoutWrapper>
            <SonnerToaster position="bottom-center" />
          </ViewportIntegrityProvider>
        </AuthProvider>
      </QueryClientProviderComponent>
    </NextIntlClientProvider>
  );
}
