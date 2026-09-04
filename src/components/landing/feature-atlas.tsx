"use client";

import { motion, useReducedMotion } from "framer-motion";

export type FeatureGroup = {
  title: string;
  description: string;
  items: string[];
};

const ACCENTS = ["#25D366", "#47A3FF", "#F6A800", "#00C28A", "#8B7CF6", "#FF6B6B"] as const;

export function FeatureAtlas({ eyebrow, title, body, groups }: { eyebrow: string; title: string; body: string; groups: FeatureGroup[] }) {
  const reduced = useReducedMotion();

  return (
    <section className="border-b border-border bg-card px-[var(--landing-gutter)] py-24 sm:py-36">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-border-strong pb-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <div>
            <h2 className="max-w-[17ch] font-display text-[clamp(2.8rem,6vw,6.3rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-foreground">{title}</h2>
            <p className="mt-6 max-w-[60ch] text-base leading-7 text-muted-foreground sm:text-lg">{body}</p>
          </div>
        </div>

        <div>
          {groups.map((group, index) => (
            <motion.article
              key={group.title}
              initial={reduced ? false : { opacity: 0, transform: "translate3d(0,20px,0)" }}
              whileInView={{ opacity: 1, transform: "translate3d(0,0,0)" }}
              viewport={{ once: true, amount: 0.32 }}
              transition={{ duration: 0.48, delay: reduced ? 0 : index * 0.045, ease: [0.23, 1, 0.32, 1] }}
              className="grid gap-5 border-b border-border py-8 md:grid-cols-[3rem_minmax(12rem,0.55fr)_minmax(0,1.45fr)] md:gap-8 md:py-10"
            >
              <div className="flex items-center gap-3 md:block">
                <span className="block h-2.5 w-2.5" style={{ backgroundColor: ACCENTS[index % ACCENTS.length] }} />
                <span className="font-mono text-[10px] text-muted-foreground md:mt-4 md:block">0{index + 1}</span>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-[-0.025em] text-foreground sm:text-2xl">{group.title}</h3>
                <p className="mt-2 max-w-[36ch] text-sm leading-6 text-muted-foreground">{group.description}</p>
              </div>
              <ul className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
                {group.items.map((item) => (
                  <li key={item} className="border-t border-border py-3 text-sm font-medium leading-5 text-foreground first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
                    {item}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
