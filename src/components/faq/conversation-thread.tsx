import { BillingTag, Panel, type Verdict } from "./faq-chrome";
import styles from "./faq.module.css";

export type ThreadTurn = {
  from: "customer" | "business";
  /** Wall clock, as the operator reads it in the inbox. */
  clock: string;
  text: string;
  verdict: Verdict;
  tag: string;
  reason: string;
  /** Approved templates get a dashed edge and a label: they are a different
   *  object from a free-form reply, and the difference is the whole point. */
  template?: string;
  /** A rule that opens above this turn: the window starting or closing. */
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

/**
 * A real conversation, priced.
 *
 * Conversation on the left, bill on the right. The verdicts land in one
 * column, which is what makes the argument readable before a word is read:
 * four amber marks in a row, or a column of green ones.
 *
 * It renders complete and static. An earlier version played itself turn by
 * turn, and because a thread is taller than the viewport the observer meant to
 * start it never fired, so readers met a tall empty box instead of a
 * conversation. A reading page shows its content.
 */
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
