"use client";

import { useFormatter, useTranslations } from "next-intl";

import { ArrowRight } from "@/components/icons";
import { Link } from "@/i18n/routing";

import { FAQ_POSTS, parseIsoDate } from "@/content/faq";
import { LegendLine } from "./faq-chrome";
import styles from "./faq.module.css";

export function FaqIndex() {
  const t = useTranslations("faq.index");
  const tPosts = useTranslations("faq.posts");
  const format = useFormatter();

  return (
    <main className={styles.root}>
      <header className={styles.indexHeader}>
        <div className={styles.shell}>
          <h1 className={styles.indexTitle}>{t("title")}</h1>
          <p className={styles.indexLead}>{t("lead")}</p>
        </div>
      </header>

      <div className={styles.indexList}>
        <div className={styles.shell}>
          {FAQ_POSTS.length === 0 ? (
            <p className={styles.indexEmpty}>{t("empty")}</p>
          ) : (
            FAQ_POSTS.map((post) => (
              <article key={post.slug} className={styles.entry}>
                <div className={styles.entryMeta}>
                  <LegendLine accent>{tPosts(`${post.key}.category`)}</LegendLine>
                  <span className={styles.metaRule} aria-hidden />
                  <LegendLine>
                    <time dateTime={post.publishedAt}>
                      {format.dateTime(parseIsoDate(post.publishedAt), {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </LegendLine>
                  <span className={styles.metaRule} aria-hidden />
                  <LegendLine>{t("readingTime", { minutes: post.readingMinutes })}</LegendLine>
                </div>

                <h2 className={styles.entryTitle}>
                  <Link href={`/faq/${post.slug}`}>{tPosts(`${post.key}.title`)}</Link>
                </h2>

                <p className={styles.entryExcerpt}>{tPosts(`${post.key}.excerpt`)}</p>

                <span className={styles.entryGo} aria-hidden>
                  <ArrowRight className="h-4 w-4" />
                </span>
              </article>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
