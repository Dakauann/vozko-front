"use client";

import type { FaqPostEntry } from "@/content/faq";

import styles from "./faq.module.css";
import { MetaServiceCostsPost } from "./posts/meta-service-costs";

export function FaqPost({ entry }: { entry: FaqPostEntry }) {
  return (
    <main className={styles.root}>
      {entry.slug === "novos-custos-meta" ? <MetaServiceCostsPost entry={entry} /> : null}
    </main>
  );
}
