"use client";

import { useFormatter, useTranslations } from "next-intl";

import {
  Barcode,
  Clock,
  Lightning,
  Megaphone,
  Robot,
  Scales,
  Wallet,
  Warning,
} from "@/components/icons";
import { Link } from "@/i18n/routing";

import { ConversationThread, type ThreadData, type ThreadLabels } from "../conversation-thread";
import {
  Callout,
  LegendLine,
  Section,
  SourceList,
  StepList,
  type SourceLink,
  type Step,
} from "../faq-chrome";
import {
  AllowanceBar,
  BillingMatrix,
  CostLedger,
  WindowClock,
  type AllowanceBarLabels,
  type BillingMatrixLabels,
  type CostLedgerLabels,
  type WindowClockLabels,
} from "../instruments";
import { parseIsoDate, type FaqPostEntry } from "@/content/faq";
import styles from "../faq.module.css";

/**
 * "Os novos custos do Meta", the FAQ's first post.
 *
 * The structure is the month, not the message. Meta's 1 October 2026 change is
 * usually written up as a rate card, which answers the wrong question: an
 * operator does not want a price list, they want to know which of the forty
 * replies they sent this morning just cost something. So the post is built
 * around the one quantity that can be spent, the 1,000 free service messages
 * per business phone number per month, and every section answers a single
 * question about it: what draws it down, when the clock runs, what three real
 * conversations cost, and what the arithmetic looks like at volume.
 *
 * Every fact is sourced in the Sources section. Nothing is claimed about this
 * product's own behaviour.
 */
export function MetaServiceCostsPost({ entry }: { entry: FaqPostEntry }) {
  const t = useTranslations("faq.posts.metaServiceCosts");
  const format = useFormatter();

  const threads = t.raw("examples.items") as ThreadData[];
  const threadLabels = t.raw("examples.thread") as ThreadLabels;
  const steps = t.raw("actions.steps") as Step[];
  const sources = t.raw("sources.items") as SourceLink[];

  const published = parseIsoDate(entry.publishedAt);

  return (
    <>
      <header className={styles.postHeader}>
        <div className={styles.shell}>
          <Link href="/faq" className={styles.backLink}>
            <span aria-hidden>&#8592;</span>
            {t("backToIndex")}
          </Link>

          <h1 className={styles.postTitle}>{t("title")}</h1>
          <p className={styles.postLead}>{t("lead")}</p>
          <p className={styles.postStandfirst}>{t("standfirst")}</p>

          <div className={styles.postMeta}>
            <LegendLine accent>{t("category")}</LegendLine>
            <span className={styles.metaRule} aria-hidden />
            <LegendLine>
              <time dateTime={entry.publishedAt}>
                {format.dateTime(published, { day: "2-digit", month: "short", year: "numeric" })}
              </time>
            </LegendLine>
            <span className={styles.metaRule} aria-hidden />
            <LegendLine>{t("readingTime", { minutes: entry.readingMinutes })}</LegendLine>
          </div>
        </div>
      </header>

      {/* 1. Whose decision this is. Readers arrive assuming their provider put
             prices up, and the article is useless until that is settled. */}
      <Section title={t("announcement.title")} intro={t("announcement.body1")}>
        <p className={styles.body}>{t("announcement.body2")}</p>
        <p className={styles.body}>{t("announcement.body3")}</p>
        <div className={styles.afterBlock}>
          <Callout
            icon={<Scales className="h-5 w-5 text-muted-foreground" aria-hidden />}
            title={t("announcement.callout.title")}
          >
            {t("announcement.callout.body")}
          </Callout>
        </div>
      </Section>

      {/* 2. The quantity the whole change turns on. */}
      <Section title={t("allowance.title")} intro={t("allowance.intro")}>
        <AllowanceBar labels={t.raw("allowance.bar") as AllowanceBarLabels} />
        <div className={styles.afterBlock}>
          <p className={styles.body}>{t("allowance.body1")}</p>
          <p className={styles.body}>{t("allowance.body2")}</p>
          <p className={styles.body}>{t("allowance.body3")}</p>
        </div>
      </Section>

      {/* 3. The clock every rule hangs off. */}
      <Section title={t("window.title")} intro={t("window.intro")}>
        <WindowClock labels={t.raw("window.clock") as WindowClockLabels} />
        <div className={styles.afterBlock}>
          <p className={styles.body}>{t("window.body1")}</p>
          <p className={styles.body}>{t("window.body2")}</p>
          <p className={styles.body}>{t("window.body3")}</p>
        </div>
      </Section>

      {/* 4. The demonstration: three ordinary days, priced. */}
      <Section title={t("examples.title")} intro={t("examples.intro")}>
        <p className={styles.body} style={{ marginBottom: "clamp(1.35rem, 2.6vw, 1.85rem)" }}>
          {t("examples.body")}
        </p>
        <div className={styles.stack}>
          {threads.map((thread) => (
            <ConversationThread key={thread.title} data={thread} labels={threadLabels} />
          ))}
        </div>
      </Section>

      {/* 5. The reference table people come back for. */}
      <Section title={t("matrix.title")} intro={t("matrix.intro")}>
        <BillingMatrix labels={t.raw("matrix.table") as BillingMatrixLabels} />
        <div className={styles.afterBlock}>
          <p className={styles.body}>{t("matrix.body")}</p>
        </div>
        <div className={styles.afterBlock}>
          <Callout
            icon={<Robot className="h-5 w-5 text-muted-foreground" aria-hidden />}
            title={t("matrix.agentCallout.title")}
          >
            {t("matrix.agentCallout.body")}
          </Callout>
        </div>
      </Section>

      {/* 6. What it costs, at the reader's own volume. */}
      <Section title={t("math.title")} intro={t("math.intro")}>
        <CostLedger labels={t.raw("math.ledger") as CostLedgerLabels} />
        <div className={styles.afterBlock}>
          <p className={styles.body}>{t("math.body")}</p>
          <p className={styles.body}>{t("math.body2")}</p>
        </div>
      </Section>

      {/* 7. The part that is actionable before the date. */}
      <Section title={t("actions.title")} intro={t("actions.intro")}>
        <StepList
          steps={steps}
          icons={[
            <Wallet key="wallet" className="h-4 w-4" aria-hidden />,
            <Lightning key="lightning" className="h-4 w-4" aria-hidden />,
            <Megaphone key="megaphone" className="h-4 w-4" aria-hidden />,
            <Barcode key="barcode" className="h-4 w-4" aria-hidden />,
            <Clock key="clock" className="h-4 w-4" aria-hidden />,
          ]}
        />
        <div className={styles.afterBlock}>
          <Callout
            icon={<Warning className="h-5 w-5 text-warning-ink" aria-hidden />}
            title={t("actions.deadline.title")}
          >
            {t("actions.deadline.body")}
          </Callout>
        </div>
      </Section>

      {/* 8. Where all of this comes from. */}
      <Section title={t("sources.title")} intro={t("sources.intro")}>
        <SourceList sources={sources} />
        <p className={`${styles.note} ${styles.afterBlock}`}>
          {t("sources.checked", {
            date: format.dateTime(published, { day: "2-digit", month: "long", year: "numeric" }),
          })}
        </p>
      </Section>

      <section className={styles.postClose}>
        <div className={styles.shell}>
          <LegendLine accent>{t("close.legend")}</LegendLine>
          <h2 className={styles.closeTitle}>{t("close.title")}</h2>
          <p className={styles.closeBody}>{t("close.body")}</p>
          <div className={styles.closeActions}>
            <Link href="/register" className={`${styles.button} ${styles.buttonPrimary}`}>
              {t("close.primaryCta")}
            </Link>
            <Link href="/faq" className={`${styles.button} ${styles.buttonSecondary}`}>
              {t("close.secondaryCta")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
