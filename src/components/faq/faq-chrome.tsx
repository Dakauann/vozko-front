
import type { ReactNode } from "react";

import { Check, Warning } from "@/components/icons";

import styles from "./faq.module.css";

export function LegendLine({
  children,
  accent = false,
  className = "",
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <p className={`${styles.legendLine} ${accent ? styles.legendAccent : ""} ${className}`}>
      {children}
    </p>
  );
}

export function Section({
  id,
  title,
  intro,
  children,
}: {
  id?: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <div className={styles.shell}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {intro ? <p className={styles.sectionIntro}>{intro}</p> : null}
        {children ? <div className={styles.sectionBlock}>{children}</div> : null}
      </div>
    </section>
  );
}

export type Verdict = "billed" | "free";

export function BillingTag({ verdict, label }: { verdict: Verdict; label: string }) {
  const billed = verdict === "billed";
  const Glyph = billed ? Warning : Check;

  return (
    <span className={`${styles.tag} ${billed ? styles.tagBilled : styles.tagFree}`}>
      <Glyph className="h-2.5 w-2.5" aria-hidden />
      {label}
    </span>
  );
}

export function Panel({
  title,
  scenario,
  aside,
  foot,
  children,
  bodyClassName,
}: {
  title?: string;
  scenario?: string;
  aside?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className={styles.panel}>
      {title ? (
        <header className={styles.panelHead}>
          <div className="min-w-0">
            <h3 className={styles.panelTitle}>{title}</h3>
            {scenario ? <p className={styles.panelScenario}>{scenario}</p> : null}
          </div>
          {aside}
        </header>
      ) : null}
      <div className={bodyClassName ?? styles.panelBody}>{children}</div>
      {foot ? <footer className={styles.panelFoot}>{foot}</footer> : null}
    </section>
  );
}

export function Callout({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.callout}>
      <span className={styles.calloutMark} aria-hidden>
        {icon}
      </span>
      <p className={styles.calloutTitle}>{title}</p>
      <p className={styles.calloutBody}>{children}</p>
    </div>
  );
}

export type SourceLink = { label: string; href: string };

export function SourceList({ sources }: { sources: SourceLink[] }) {
  return (
    <div className={styles.sources}>
      {sources.map((source) => (
        <a
          key={source.href}
          href={source.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.source}
        >
          <span>{source.label}</span>
          <span className={styles.sourceHost}>{hostOf(source.href)}</span>
        </a>
      ))}
    </div>
  );
}

function hostOf(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export type Step = { title: string; body: string };

export function StepList({ steps, icons }: { steps: Step[]; icons: ReactNode[] }) {
  return (
    <div className={styles.steps}>
      {steps.map((step, index) => (
        <div key={step.title} className={styles.step}>
          <span className={styles.stepMark} aria-hidden>
            {icons[index] ?? null}
          </span>
          <h3 className={styles.stepTitle}>{step.title}</h3>
          <p className={styles.stepBody}>{step.body}</p>
        </div>
      ))}
    </div>
  );
}
