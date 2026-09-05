import Image from "next/image";
import styles from "./landing.module.css";

export function ProviderTrust({ title, body }: { title: string; body: string }) {
  return (
    <section className={styles.providerTrust} aria-labelledby="provider-title">
      <div>
        <h2 id="provider-title" className="max-w-[22ch] font-display text-[clamp(2rem,3.6vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground">{title}</h2>
        <p className="mt-4 max-w-[54ch] text-base leading-7 text-muted-foreground">{body}</p>
      </div>
      <div className="w-full max-w-[21rem] justify-self-start lg:justify-self-end">
        <Image src="/images/partners/meta-business-partner-two-line-light.svg" alt="Meta Business Partner" width={512} height={168} className="h-auto w-full dark:hidden" />
        <Image src="/images/partners/meta-business-partner-two-line-dark.svg" alt="Meta Business Partner" width={512} height={168} className="hidden h-auto w-full dark:block" />
      </div>
    </section>
  );
}
