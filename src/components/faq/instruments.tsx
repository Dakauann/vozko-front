"use client";

import { useId, useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { BillingTag, LegendLine, Panel, type Verdict } from "./faq-chrome";
import styles from "./faq.module.css";

/* ── The allowance bar ─────────────────────────────────────────────────── */

export type AllowanceBarLabels = {
  panelTitle: string;
  panelScenario: string;
  freeLabel: string;
  billedLabel: string;
  scaleStart: string;
  scaleEnd: string;
  foot: string;
};

const FREE_TIER = 1000;

/**
 * The one number a reader has to leave with, drawn as a quantity that can be
 * spent rather than as a statistic in a box.
 *
 * Two parts, one division. The division IS the article: everything left of it
 * is free, everything right of it is invoiced. Each part carries its own count
 * and its own word inside itself, so the bar needs no legend underneath.
 */
export function AllowanceBar({
  labels,
  monthTotal = 1250,
}: {
  labels: AllowanceBarLabels;
  monthTotal?: number;
}) {
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const free = Math.min(monthTotal, FREE_TIER);
  const billed = Math.max(0, monthTotal - FREE_TIER);

  return (
    <Panel
      title={labels.panelTitle}
      scenario={labels.panelScenario}
      bodyClassName={styles.barWrap}
      foot={labels.foot}
    >
      <div
        className={styles.bar}
        role="img"
        aria-label={`${nf.format(free)} ${labels.freeLabel}. ${nf.format(billed)} ${labels.billedLabel}.`}
      >
        <div className={`${styles.barPart} ${styles.barFree}`} style={{ flex: `${free} 1 0` }}>
          <span className={styles.barValue}>{nf.format(free)}</span>
          <span className={styles.barLabel}>{labels.freeLabel}</span>
        </div>
        <div className={`${styles.barPart} ${styles.barBilled}`} style={{ flex: `${billed} 1 0` }}>
          <span className={styles.barValue}>{nf.format(billed)}</span>
          <span className={styles.barLabel}>{labels.billedLabel}</span>
        </div>
      </div>

      <div className={styles.barScale} aria-hidden>
        <LegendLine>{labels.scaleStart}</LegendLine>
        <LegendLine>{labels.scaleEnd}</LegendLine>
      </div>
    </Panel>
  );
}

/* ── The 24-hour window, as a vertical clock ───────────────────────────── */

export type ClockStep = {
  time: string;
  body: string;
  /** Present when this moment has a price attached. */
  tag?: string;
  verdict?: Verdict;
};

export type WindowClockLabels = {
  panelTitle: string;
  panelScenario: string;
  steps: ClockStep[];
  foot: string;
};

/** Which marks sit inside the open window, and what each one is. Design lives
 *  here; every word on the diagram comes from the locale file. */
const CLOCK_SPEC = [
  { kind: "open", open: true },
  { kind: "billed", open: true },
  { kind: "billed", open: true },
  { kind: "close", open: false },
  { kind: "billed", open: false },
] as const;

export function WindowClock({ labels }: { labels: WindowClockLabels }) {
  return (
    <Panel
      title={labels.panelTitle}
      scenario={labels.panelScenario}
      bodyClassName={styles.clock}
      foot={labels.foot}
    >
      {labels.steps.slice(0, CLOCK_SPEC.length).map((step, index) => {
        const spec = CLOCK_SPEC[index];
        return (
          <div key={step.time} className={styles.clockStep} data-open={spec.open}>
            <span className={styles.clockMark} data-kind={spec.kind} aria-hidden />
            <div>
              <div className={styles.clockHead}>
                <span className={styles.clockTime}>{step.time}</span>
                {step.tag && step.verdict ? (
                  <BillingTag verdict={step.verdict} label={step.tag} />
                ) : null}
              </div>
              <p className={styles.clockBody}>{step.body}</p>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

/* ── The decision table ────────────────────────────────────────────────── */

export type MatrixRow = {
  type: string;
  kind: string;
  before: string;
  beforeVerdict: Verdict;
  after: string;
  afterVerdict: Verdict;
  changedFlag?: string;
};

export type BillingMatrixLabels = {
  caption: string;
  columnType: string;
  columnBefore: string;
  columnAfter: string;
  rows: MatrixRow[];
};

/**
 * The reference the reader comes back for.
 *
 * Two dated columns rather than one "new pricing" list, because the question
 * people arrive with is "what changed" and a single column cannot answer it.
 * Rows that moved carry a faint warning ground and say so in a word, so the
 * change never rests on the tint alone.
 */
export function BillingMatrix({ labels }: { labels: BillingMatrixLabels }) {
  return (
    <div className={styles.matrixScroll}>
      <table className={styles.matrix}>
        <caption className="sr-only">{labels.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{labels.columnType}</th>
            <th scope="col">{labels.columnBefore}</th>
            <th scope="col">{labels.columnAfter}</th>
          </tr>
        </thead>
        <tbody>
          {labels.rows.map((row) => (
            <tr key={row.type} className={row.changedFlag ? styles.matrixChanged : undefined}>
              <th scope="row">
                {row.type}
                <span className={styles.matrixKind}>{row.kind}</span>
                {row.changedFlag ? (
                  <span className={styles.matrixFlag}>{row.changedFlag}</span>
                ) : null}
              </th>
              <td>
                <BillingTag verdict={row.beforeVerdict} label={row.before} />
              </td>
              <td>
                <BillingTag verdict={row.afterVerdict} label={row.after} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── The month's arithmetic ────────────────────────────────────────────── */

export type CostLedgerLabels = {
  panelTitle: string;
  panelScenario: string;
  inputLabel: string;
  sent: string;
  freeTier: string;
  billable: string;
  rate: string;
  rateNote: string;
  fx: string;
  fxNote: string;
  total: string;
  disclaimer: string;
};

/**
 * Brazil's reference utility and authentication rate, which is what a service
 * message costs there from 1 October 2026. It is a reference figure, not a
 * quote: the rate follows the RECIPIENT's country, and providers may add their
 * own fee. Sourced and date-stamped in the post's own copy.
 */
const REFERENCE_RATE_USD = 0.0068;
/** USD to BRL on 14 September 2026, stated on the page so it can be checked. */
const FX_USD_BRL = 5.12;

export function CostLedger({ labels }: { labels: CostLedgerLabels }) {
  const locale = useLocale();
  const sliderId = useId();
  const [sent, setSent] = useState(4000);

  /* Brazilian readers budget in reais and Meta invoices in dollars, so both
     are on the total line. Which one leads follows the reader's own locale. */
  const brlLeads = locale === "pt";

  const fmt = useMemo(() => {
    const money = (currency: string, digits?: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        ...(digits === undefined ? {} : { minimumFractionDigits: digits }),
      });
    return {
      n: new Intl.NumberFormat(locale),
      usd: money("USD"),
      brl: money("BRL"),
      usdRate: money("USD", 4),
      brlRate: money("BRL", 2),
    };
  }, [locale]);

  const billable = Math.max(0, sent - FREE_TIER);
  const usd = billable * REFERENCE_RATE_USD;
  const brl = usd * FX_USD_BRL;

  const lead = brlLeads ? fmt.brl.format(brl) : fmt.usd.format(usd);
  const alt = brlLeads ? fmt.usd.format(usd) : fmt.brl.format(brl);

  return (
    <Panel
      title={labels.panelTitle}
      scenario={labels.panelScenario}
      bodyClassName=""
      foot={undefined}
    >
      <div className={styles.ledgerInput}>
        <label className={styles.legendLine} htmlFor={sliderId}>
          {labels.inputLabel}
        </label>
        <input
          id={sliderId}
          className={styles.ledgerSlider}
          type="range"
          min={0}
          max={20000}
          step={250}
          value={sent}
          onChange={(event) => setSent(Number(event.target.value))}
        />
        <output htmlFor={sliderId} className={styles.ledgerValue}>
          {fmt.n.format(sent)}
        </output>
      </div>

      <div className={styles.ledgerRow}>
        <span className={styles.ledgerLabel}>{labels.sent}</span>
        <span className={styles.ledgerValue}>{fmt.n.format(sent)}</span>
      </div>
      <div className={styles.ledgerRow}>
        <span className={styles.ledgerLabel}>{labels.freeTier}</span>
        <span className={styles.ledgerValue}>
          {fmt.n.format(Math.min(sent, FREE_TIER))}
        </span>
      </div>
      <div className={styles.ledgerRow}>
        <span className={styles.ledgerLabel}>{labels.billable}</span>
        <span className={styles.ledgerValue}>{fmt.n.format(billable)}</span>
      </div>
      <div className={styles.ledgerRow}>
        <span className={styles.ledgerLabel}>
          {labels.rate}
          <span className={styles.matrixKind}>{labels.rateNote}</span>
        </span>
        <span className={styles.ledgerValue}>{fmt.usdRate.format(REFERENCE_RATE_USD)}</span>
      </div>
      <div className={styles.ledgerRow}>
        <span className={styles.ledgerLabel}>
          {labels.fx}
          <span className={styles.matrixKind}>{labels.fxNote}</span>
        </span>
        <span className={styles.ledgerValue}>{fmt.brlRate.format(FX_USD_BRL)}</span>
      </div>
      <div className={`${styles.ledgerRow} ${styles.ledgerTotal}`}>
        <span className={styles.ledgerLabel}>{labels.total}</span>
        <span className={styles.ledgerTotalValue}>
          {lead}
          <span className={styles.ledgerTotalAlt}>{alt}</span>
        </span>
      </div>
      <p className={styles.ledgerNote}>{labels.disclaimer}</p>
    </Panel>
  );
}
