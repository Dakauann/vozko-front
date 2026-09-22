"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowLeft } from "@/components/icons";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { getBrand } from "@/config/brand";
import { useLocale, useTranslations } from "next-intl";

export interface LegalDocumentProps {
  namespace: "termsOfService" | "privacyPolicy";
  sections: string[];
  lastUpdated: string;
  version: string;
}

function useReadingMinutes(texts: string[]): number {
  return useMemo(() => {
    const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [texts]);
}

export default function LegalDocument({
  namespace,
  sections,
  lastUpdated,
  version,
}: LegalDocumentProps) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const brand = getBrand();
  const [activeId, setActiveId] = useState<string>(sections[0] ?? "");
  const headingRefs = useRef<Record<string, HTMLElement | null>>({});

  const values = useMemo(
    () => ({
      brandName: brand.name,
      brandLegalName: brand.legalName,
      brandCnpj: brand.cnpj,
      siteUrl: brand.siteUrl,
      dpoEmail: brand.dpoEmail,
      supportEmail: brand.supportEmail,
    }),
    [brand],
  );

  const clauses = useMemo(
    () =>
      sections.map((key, i) => ({
        key,
        number: i + 1,
        title: t(`sections.${key}.title`),
        content: t(`sections.${key}.content`, values),
      })),
    [sections, t, values],
  );

  const minutes = useReadingMinutes(clauses.map((c) => c.content));

  const formattedDate = useMemo(
    () =>
      new Date(`${lastUpdated}T00:00:00`).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [lastUpdated, locale],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );
    for (const el of Object.values(headingRefs.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [clauses.length]);

  return (
    <main className="bg-background">
      {}
      <header className="rule-engraved bg-card">
        <div className="mx-auto w-full max-w-[1100px] px-4 pb-8 pt-8 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="legend inline-flex items-center gap-1.5 rounded-[--radius] transition-colors hover:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            {t("backHome")}
          </Link>

          <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.1] tracking-[0.01em] text-foreground sm:text-4xl">
            {t("title")}
          </h1>

          <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            {t("intro", values)}
          </p>

          {
}
          <dl className="mt-6 flex flex-wrap items-baseline gap-x-10 gap-y-3">
            {[
              { label: t("meta.version"), value: version },
              { label: t("meta.updated"), value: formattedDate },
              { label: t("meta.clauses"), value: String(clauses.length) },
              { label: t("meta.reading"), value: t("meta.minutes", { minutes }) },
            ].map((item) => (
              <div key={item.label}>
                <dt className="legend">{item.label}</dt>
                <dd className="readout mt-1 text-sm font-semibold text-foreground">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="gap-12 py-10 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
          {}
          <nav
            aria-label={t("tableOfContents")}
            className="mb-8 lg:sticky lg:top-16 lg:mb-0 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
          >
            <p className="legend mb-2 border-b border-border pb-2">
              {t("tableOfContents")}
            </p>
            <ol className="space-y-px">
              {clauses.map((c) => {
                const current = activeId === c.key;
                return (
                  <li key={c.key}>
                    <a
                      href={`#${c.key}`}
                      aria-current={current ? "true" : undefined}
                      className={cn(
                        "flex items-start gap-2 rounded-[--radius] py-1.5 pr-2 text-xs leading-snug transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        current
                          ? "bg-muted font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("lamp mt-0.5", !current && "opacity-0")}
                      />
                      <span className="readout w-4 shrink-0 tabular-nums opacity-60">
                        {c.number}
                      </span>
                      <span className="min-w-0">{c.title}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>

          {}
          <article className="min-w-0">
            {clauses.map((c) => (
              <section
                key={c.key}
                id={c.key}
                className="scroll-mt-16 border-b border-border py-8 first:pt-0 last:border-b-0"
              >
                <h2
                  ref={(el) => {
                    headingRefs.current[c.key] = el;
                  }}
                  id={c.key}
                  className="flex items-baseline gap-3 font-display text-xl font-semibold leading-snug tracking-[0.01em] text-foreground"
                >
                  <span className="readout shrink-0 text-base tabular-nums text-muted-foreground">
                    {c.number}
                  </span>
                  {c.title}
                </h2>

                <div className="mt-3 space-y-3">
                  {c.content.split("\n\n").map((para, i) => {
                    const isList = para.trimStart().startsWith("•");
                    if (isList) {
                      const items = para
                        .split("\n")
                        .map((l) => l.replace(/^\s*•\s*/, "").trim())
                        .filter(Boolean);
                      return (
                        <ul key={i} className="space-y-1.5">
                          {items.map((item, j) => (
                            <li
                              key={j}
                              className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-[0.6em] h-px w-2.5 shrink-0 bg-border"
                              />
                              <span className="min-w-0 max-w-[68ch]">{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p
                        key={i}
                        className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground"
                      >
                        {para}
                      </p>
                    );
                  })}
                </div>
              </section>
            ))}

            <aside className="well mt-10 p-5">
              <p className="text-sm font-semibold text-foreground">
                {t("questions")}
              </p>
              <a
                href={`mailto:${
                  namespace === "privacyPolicy"
                    ? brand.dpoEmail
                    : brand.supportEmail
                }`}
                className="readout mt-1.5 inline-block rounded-[--radius] text-sm text-primary-ink underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {namespace === "privacyPolicy"
                  ? brand.dpoEmail
                  : brand.supportEmail}
              </a>
            </aside>
          </article>
        </div>
      </div>
    </main>
  );
}
