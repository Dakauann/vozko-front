import { BillingTag, Panel, type Verdict } from "./faq-chrome";
import styles from "./faq.module.css";

export type ThreadTurn = {
  from: "customer" | "business";
  clock: string;
  text: string;
  verdict: Verdict;
  tag: string;
  reason: string;
  template?: string;
  banner?: string;
  bannerTone?: "neutral" | "free";
};

export type ThreadLabels = {
  billedUnit: string;
};

export type ThreadData = {
  title: string;
  scenario: string;
  verdict: string;
  turns: ThreadTurn[];
};

export function ConversationThread({
  data,
  labels,
}: {
  data: ThreadData;
  labels: ThreadLabels;
}) {
  const billed = data.turns.filter((turn) => turn.verdict === "billed").length;

  return (
    <Panel
      title={data.title}
      scenario={data.scenario}
      aside={
        <span className={styles.tally} data-zero={billed === 0}>
          <span className={styles.tallyValue}>{billed}</span>
          {labels.billedUnit}
        </span>
      }
      foot={data.verdict}
      bodyClassName={styles.threadBody}
    >
      {data.turns.map((turn, index) => (
        <div key={`${turn.clock}-${index}`} className={styles.turn} data-from={turn.from}>
          {turn.banner ? (
            <p
              className={`${styles.windowBanner} ${
                turn.bannerTone === "free" ? styles.windowBannerFree : ""
              }`}
            >
              {turn.banner}
            </p>
          ) : null}

          <span className={styles.turnClock}>{turn.clock}</span>

          <div className={styles.turnMessage}>
            <p
              className={`${styles.bubble} ${
                turn.from === "customer" ? styles.bubbleCustomer : styles.bubbleBusiness
              } ${turn.template ? styles.bubbleTemplate : ""}`}
            >
              {turn.template ? (
                <span className={styles.templateMark}>{turn.template}</span>
              ) : null}
              {turn.text}
            </p>
          </div>

          <div className={styles.turnVerdict}>
            <BillingTag verdict={turn.verdict} label={turn.tag} />
            <span className={styles.turnReason}>{turn.reason}</span>
          </div>
        </div>
      ))}
    </Panel>
  );
}
