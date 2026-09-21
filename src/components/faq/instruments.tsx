"use client";

import { BillingTag, Panel, type Verdict } from "./faq-chrome";
import styles from "./faq.module.css";


export type ClockStep = {
  time: string;
  body: string;
  tag?: string;
  verdict?: Verdict;
};

export type WindowClockLabels = {
  panelTitle: string;
  panelScenario: string;
  steps: ClockStep[];
  foot: string;
};

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
