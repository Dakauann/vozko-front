"use client";

import type { FaqPostEntry } from "@/content/faq";

import styles from "./faq.module.css";
import { MetaServiceCostsPost } from "./posts/meta-service-costs";

/**
 * The post shell.
 *
 * One `main` in the FAQ's world; the body is chosen by slug. Each post is its
 * own component rather than a generic renderer over a content blob, because
 * these are designed explanations. The instruments in this first one (an
 * allowance meter, three annotated transcripts, a decision table) are the
 * argument, and a generic block renderer would flatten them into prose.
 */
export function FaqPost({ entry }: { entry: FaqPostEntry }) {
  return (
    <main className={styles.root}>
      {entry.slug === "novos-custos-meta" ? <MetaServiceCostsPost entry={entry} /> : null}
    </main>
  );
}
