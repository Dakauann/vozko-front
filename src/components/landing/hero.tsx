"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "@/components/icons";
import { CircuitTraces } from "@/components/brand/circuit";
import { Link } from "@/i18n/routing";
import styles from "./landing.module.css";

export type HeroLabels = {
  titleLine1: string;
  titleLine2: string;
  body: string;
  primaryCta: string;
  secondaryCta: string;
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function Hero({ labels }: { labels: HeroLabels }) {
  const reduced = useReducedMotion() ?? false;

  const reveal = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, transform: "translate3d(0,18px,0)" },
    animate: { opacity: 1, transform: "translate3d(0,0,0)" },
    transition: { duration: 0.7, delay, ease: EASE_OUT },
  });

  return (
    <header className={styles.hero}>
      <div className={styles.heroOrnament} aria-hidden />
      <div className={styles.heroInner}>
        <div className={styles.heroGrid}>
          <motion.h1 {...reveal(0)} className={styles.heroTitle}>
            <span>{labels.titleLine1}</span>
            <span>{labels.titleLine2}</span>
          </motion.h1>

          {/* The board's own trace bundle, at the scale it has in the identity:
              the rising run that ends where the page's story begins. */}
          <div className={styles.heroTrails} aria-hidden>
            <CircuitTraces dynamic seed={271} branches={7} className="h-full w-full" />
          </div>

          <motion.div {...reveal(0.1)} className={styles.heroFooter}>
            <p className={styles.heroBody}>{labels.body}</p>
            <div className={styles.heroActions}>
              <Link href="/register" className={`${styles.button} ${styles.buttonPrimary}`}>
                {labels.primaryCta} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#fluxo" className={`${styles.button} ${styles.buttonSecondary}`}>
                {labels.secondaryCta}
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
