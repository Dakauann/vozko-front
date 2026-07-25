"use client";

import {
  ArrowRight,
  CaretDown,
  CurrencyDollar,
  PhoneOutgoing,
  Headset,
  Phone,
  ChatCircleDots,
  PhoneCall,
  GearSix,
  ArrowsClockwise,
  Play,
  Pause,
  Rocket,
  Plugs,
  ChartLineUp,
  BookOpenText,
  Envelope,
  ChatTeardropText,
  UserCircle,
  PaperPlaneTilt,
  CheckCircle,
  WhatsappLogo,
  Funnel,
  Brain,
  Tag,
  Lightning,
  TrendUp,
  Star,
  DotsSixVertical,
  MagnifyingGlass,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import GrainBackground, {
  type GrainPalette,
} from "@/components/elevated-design/grain-background";
import GrainCard from "@/components/elevated-design/grain-card";
import { useTranslations } from "next-intl";
import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { getBrand } from "@/config/brand";
import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import {
  PricingSection,
  type AffiliateBrand,
} from "@/components/landing/pricing-section";

const BrainScene = dynamic(() => import("@/components/3d/brain-scene"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] w-[480px] flex items-center justify-center">
      <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  ),
});

type AutomationModule = {
  icon: Icon;
  titleKey: string;
  descriptionKey: string;
};

type Differentiator = {
  icon: Icon;
  titleKey: string;
  descriptionKey: string;
};

type MetricHighlight = {
  valueKey: string;
  labelKey: string;
  descriptionKey: string;
};

const automationModules: AutomationModule[] = [
  {
    icon: CurrencyDollar,
    titleKey: "collectionTitle",
    descriptionKey: "collectionDescription",
  },
  {
    icon: PhoneOutgoing,
    titleKey: "outboundTitle",
    descriptionKey: "outboundDescription",
  },
  {
    icon: Headset,
    titleKey: "supportTitle",
    descriptionKey: "supportDescription",
  },
  {
    icon: PhoneCall,
    titleKey: "dialerTitle",
    descriptionKey: "dialerDescription",
  },
];

const differentiators: Differentiator[] = [
  {
    icon: Rocket,
    titleKey: "launch.title",
    descriptionKey: "launch.description",
  },
  {
    icon: Plugs,
    titleKey: "ecosystem.title",
    descriptionKey: "ecosystem.description",
  },
  {
    icon: ChartLineUp,
    titleKey: "operational.title",
    descriptionKey: "operational.description",
  },
  {
    icon: BookOpenText,
    titleKey: "playbooks.title",
    descriptionKey: "playbooks.description",
  },
];

const metricHighlights: MetricHighlight[] = [
  {
    valueKey: "agility.value",
    labelKey: "agility.label",
    descriptionKey: "agility.description",
  },
  {
    valueKey: "retention.value",
    labelKey: "retention.label",
    descriptionKey: "retention.description",
  },
  {
    valueKey: "cost.value",
    labelKey: "cost.label",
    descriptionKey: "cost.description",
  },
];

const PARTNER_BRANDS: { name?: string; logo?: string }[] = [
  // {
  //   name: "Cartão de Todos Belém",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos Juiz de Fora",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos Criciúma",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos Osasco",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos Campo Mourão",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos Itaquera",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos Pinheiros",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos São Matheus",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos S. Miguel Paulista",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
  // {
  //   name: "Cartão de Todos Vitória",
  //   logo: "/images/partners/cartao_de_todos_sfb.png",
  // },
];

interface HomeProps {
  plans?: PublicPlanDetails[];
  annualDiscountPct?: number;
  affiliateBrand?: AffiliateBrand | null;
}

export default function Home({
  plans = [],
  annualDiscountPct = 0,
  affiliateBrand = null,
}: HomeProps) {
  const t = useTranslations();
  const contentRef = useRef<HTMLDivElement>(null);
  const brand = getBrand();
  return (
    <main
      ref={contentRef}
      className="min-h-screen overflow-x-clip bg-background text-foreground"
    >
      <section className="relative mt-10 min-h-screen overflow-x-clip bg-background">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />
          <div className="absolute left-0 right-0 bottom-0 h-[48vh] pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 dark:from-blue-500/15 to-transparent blur-3xl" />
            <div className="absolute inset-0 flex justify-center">
              <div
                className="blue-shift w-full h-full"
                style={{
                  background:
                    "radial-gradient(ellipse at center bottom, rgba(96,165,250,0.32) 0%, rgba(96,165,250,0.12) 28%, transparent 65%)",
                  filter: "blur(80px)",
                }}
              />
            </div>
          </div>
        </div>

        {/* 3D brain, cropped ~1/4 off right viewport edge */}
        <div className="pointer-events-auto absolute right-0 top-1/2 hidden max-w-[100vw] -translate-y-1/2 overflow-hidden lg:block">
          <BrainScene className="h-[700px] w-[700px] xl:h-[850px] xl:w-[850px] 2xl:h-[950px] 2xl:w-[950px]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center gap-12 px-6 py-24 md:px-10 lg:py-32">
          {/* Left: text content */}
          <div className="flex flex-col justify-center sm:mr-auto lg:max-w-[55%]">
            <h1 className="mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg">
              {t("hero.description")}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                variant="main-cta"
                title={t("hero.cta.primary")}
                iconVisible
                iconSide="right"
                icon={<ArrowRight weight="bold" className="h-4 w-4" />}
                link="/login"
                newTab={false}
              />
              <Button
                variant="ghost"
                title={t("hero.cta.secondary")}
                iconVisible
                iconSide="right"
                icon={<ArrowRight weight="bold" className="h-4 w-4" />}
                link="#stack"
                newTab={false}
                className="border border-border text-foreground hover:bg-muted/50"
              />
            </div>
          </div>
        </div>

        <div className="relative flex justify-center pb-10">
          <div className="flex flex-col items-center gap-3 text-[10px] font-semibold uppercase text-muted-foreground">
            <span>{t("hero.scroll")}</span>
            <span className="h-12 w-px bg-border" />
            <CaretDown weight="bold" className="h-4 w-4" />
          </div>
        </div>

        <style>{`
          .hero-hue-line {
            background: linear-gradient(
              to bottom,
              transparent 0%,
              hsl(var(--primary)) 16%,
              hsl(var(--primary)) 84%,
              transparent 100%
            );
            box-shadow: 0 0 18px 1px hsl(var(--primary) / 0.45);
            animation: hero-hue 9s ease-in-out infinite alternate;
            will-change: filter;
          }
          @keyframes hero-hue {
            from { filter: hue-rotate(-38deg); }
            to { filter: hue-rotate(48deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            .hero-hue-line { animation: none; }
          }
        `}</style>
      </section>

      {/* ── Trusted Brands ── */}
      <section className="relative overflow-hidden">
        <GrainBackground
          palette="slate"
          seed={33}
          className="rounded-none py-10"
          opacity={0.35}
        >
          <div
            className="relative flex overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
            }}
          >
            <div
              className="flex shrink-0 items-center gap-20 px-10"
              style={{ animation: "scroll-brands 30s linear infinite" }}
            >
              {[...PARTNER_BRANDS, ...PARTNER_BRANDS].map((brand, i) => (
                <div
                  key={`${brand.name}-${i}`}
                  className="flex h-14 shrink-0 items-center justify-center gap-3"
                >
                  {brand.logo && (
                    <Image
                      src={brand.logo}
                      alt={brand.name ?? ""}
                      width={300}
                      height={100}
                      className="h-14 w-auto object-contain brightness-0 invert opacity-80 hover:brightness-100 hover:invert-0 hover:opacity-100 transition-all duration-300"
                    />
                  )}
                  {brand.name && (
                    <span className="text-xl font-bold tracking-wide text-white/80 whitespace-nowrap">
                      {brand.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </GrainBackground>
      </section>

      {/* ── CRM Showcase ── */}
      <CRMShowcase />

      <section
        id="stack"
        className="relative overflow-hidden bg-background py-24"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[600px] h-[600px] rounded-full opacity-10"
            style={{
              background:
                "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 md:px-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl text-foreground">
              {t("howItWorksHome.title")}
            </h2>
            <p className="mt-5 text-pretty text-sm text-muted-foreground md:text-base">
              {t("howItWorksHome.description")}
            </p>
          </div>

          <div className="mt-16 relative">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent hidden lg:block" />

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 relative">
              <div className="flex flex-col items-center text-center">
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                  <GearSix className="h-10 w-10" weight="duotone" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {t("howItWorksHome.step1.title")}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("howItWorksHome.step1.description")}
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                  <PhoneCall className="h-10 w-10" weight="duotone" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {t("howItWorksHome.step2.title")}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("howItWorksHome.step2.description")}
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                  <ChatCircleDots className="h-10 w-10" weight="duotone" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {t("howItWorksHome.step3.title")}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("howItWorksHome.step3.description")}
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                  <ArrowsClockwise className="h-10 w-10" weight="duotone" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {t("howItWorksHome.step4.title")}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("howItWorksHome.step4.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="diferenciais"
        className="relative overflow-hidden bg-background py-24"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[700px] h-[700px] rounded-full opacity-10"
            style={{
              background:
                "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 md:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.85fr,1.15fr] lg:items-start">
            <div className="max-w-xl">
              <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl text-foreground">
                {t("differentiators.title")}
              </h2>
              <p className="mt-5 text-pretty text-sm text-muted-foreground md:text-base">
                {t("differentiators.description")}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  variant="ghost"
                  title={t("differentiators.cta")}
                  iconVisible
                  iconSide="right"
                  icon={<ArrowRight className="h-4 w-4" />}
                  link="#metricas"
                  newTab={false}
                  className="border border-border text-foreground hover:bg-muted/50"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {differentiators.map((item, i) => {
                const palettes: GrainPalette[] = [
                  "forest",
                  "ocean",
                  "aurora",
                  "emerald",
                ];
                return (
                  <GrainCard
                    key={item.titleKey}
                    variant="feature"
                    size="lg"
                    icon={item.icon}
                    title={t(`differentiators.items.${item.titleKey}`)}
                    description={t(
                      `differentiators.items.${item.descriptionKey}`,
                    )}
                    palette={palettes[i % palettes.length]}
                    seed={100 + i * 23}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="metricas"
        className="relative overflow-hidden bg-background py-24"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[600px] h-[600px] rounded-full opacity-10"
            style={{
              background:
                "radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 text-center md:px-10">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl text-foreground">
            {t("metrics.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm text-muted-foreground md:text-base">
            {t("metrics.description")}
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {metricHighlights.map((metric, i) => {
              const palettes: GrainPalette[] = ["sunset", "ocean", "emerald"];
              return (
                <GrainCard
                  key={metric.labelKey}
                  variant="metric"
                  value={t(`metrics.items.${metric.valueKey}`)}
                  label={t(`metrics.items.${metric.labelKey}`)}
                  description={t(`metrics.items.${metric.descriptionKey}`)}
                  palette={palettes[i % palettes.length]}
                  seed={200 + i * 31}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      {plans.length > 0 && (
        <PricingSection
          plans={plans}
          annualDiscountPct={annualDiscountPct}
          affiliateBrand={affiliateBrand}
        />
      )}

      <section id="encerramento" className="relative overflow-hidden py-24">
        <div className="relative mx-auto w-full max-w-5xl px-6 md:px-10">
          <GrainBackground palette="ocean" seed={77} className="rounded-3xl">
            <div className="flex flex-col items-center gap-8 px-8 py-16 text-center md:px-16">
              <h2 className="text-3xl font-semibold md:text-5xl text-white">
                {t("closing.title")}
              </h2>
              <p className="text-sm text-white/70 md:text-base max-w-2xl">
                {t("closing.description")}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  variant="main-cta"
                  title={t("closing.cta.primary")}
                  iconVisible
                  iconSide="right"
                  icon={<ArrowRight className="h-4 w-4" />}
                  link="/login"
                  newTab={false}
                />
              </div>
            </div>
          </GrainBackground>
        </div>
      </section>

      <style>{`
        @keyframes scroll-brands {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}

/* ── CRM Showcase – smooth multi-view demo ──────────────────────────── */

type CRMView = "inbox" | "conversation" | "funnel" | "ai";

const CRM_VIEWS: { key: CRMView; label: string; icon: Icon; dur: number }[] = [
  { key: "inbox", label: "Inbox", icon: Envelope, dur: 8000 },
  {
    key: "conversation",
    label: "Conversas",
    icon: ChatTeardropText,
    dur: 12000,
  },
  { key: "funnel", label: "Funil", icon: Funnel, dur: 12000 },
  { key: "ai", label: "IA & Análise", icon: Brain, dur: 12000 },
];

const TOTAL_CRM = CRM_VIEWS.reduce((s, v) => s + v.dur, 0);

/* cursor target positions per view+step (percentage-based x,y inside the panel) */
const CURSOR_POSITIONS: Record<string, { x: number; y: number }> = {
  "inbox-0": { x: 12, y: 22 },
  "inbox-1": { x: 18, y: 32 },
  "inbox-2": { x: 12, y: 42 },
  "inbox-3": { x: 18, y: 52 },
  "conversation-0": { x: 15, y: 28 },
  "conversation-1": { x: 70, y: 50 },
  "conversation-2": { x: 85, y: 82 },
  "conversation-3": { x: 85, y: 82 },
  "conversation-4": { x: 90, y: 12 },
  "conversation-5": { x: 92, y: 12 },
  "funnel-0": { x: 50, y: 30 },
  "funnel-1": { x: 18, y: 40 },
  "funnel-2": { x: 42, y: 45 },
  "funnel-3": { x: 65, y: 42 },
  "funnel-4": { x: 50, y: 90 },
  "ai-0": { x: 30, y: 30 },
  "ai-1": { x: 35, y: 45 },
  "ai-2": { x: 70, y: 35 },
  "ai-3": { x: 70, y: 55 },
  "ai-4": { x: 50, y: 88 },
};

function CRMShowcase() {
  const [view, setView] = useState<CRMView>("inbox");
  const [progress, setProgress] = useState(0);
  const [subStep, setSubStep] = useState(0);
  const cursorRef = useRef<HTMLDivElement>(null);
  const viewTransitionRef = useRef(0);

  /* master cycle */
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    const schedule = () => {
      let offset = 0;
      for (const v of CRM_VIEWS) {
        const d = offset;
        timers.push(
          setTimeout(() => {
            setView(v.key);
            setProgress(0);
            setSubStep(0);
          }, d),
        );
        offset += v.dur;
      }
      timers.push(setTimeout(schedule, TOTAL_CRM));
    };
    schedule();
    return () => timers.forEach(clearTimeout);
  }, []);

  /* progress bar */
  useEffect(() => {
    const dur = CRM_VIEWS.find((v) => v.key === view)?.dur ?? 8000;
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - start;
      setProgress(Math.min(elapsed / dur, 1));
      if (elapsed < dur) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  /* sub-step timers per view */
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    if (view === "inbox") {
      timers.push(setTimeout(() => setSubStep(1), 1500));
      timers.push(setTimeout(() => setSubStep(2), 3500));
      timers.push(setTimeout(() => setSubStep(3), 5500));
    } else if (view === "conversation") {
      timers.push(setTimeout(() => setSubStep(1), 1500));
      timers.push(setTimeout(() => setSubStep(2), 4000));
      timers.push(setTimeout(() => setSubStep(3), 6500));
      timers.push(setTimeout(() => setSubStep(4), 9000));
      timers.push(setTimeout(() => setSubStep(5), 10500));
    } else if (view === "funnel") {
      timers.push(setTimeout(() => setSubStep(1), 1500));
      timers.push(setTimeout(() => setSubStep(2), 4000));
      timers.push(setTimeout(() => setSubStep(3), 7000));
      timers.push(setTimeout(() => setSubStep(4), 9500));
    } else if (view === "ai") {
      timers.push(setTimeout(() => setSubStep(1), 1500));
      timers.push(setTimeout(() => setSubStep(2), 4000));
      timers.push(setTimeout(() => setSubStep(3), 7000));
      timers.push(setTimeout(() => setSubStep(4), 9500));
    }
    return () => timers.forEach(clearTimeout);
  }, [view]);

  /* smooth cursor movement via DOM (no setState) */
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    const key = `${view}-${subStep}`;
    const pos = CURSOR_POSITIONS[key];
    if (pos) {
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      el.style.opacity = "1";
    }
  }, [view, subStep]);

  /* briefly hide cursor on view transition */
  useEffect(() => {
    viewTransitionRef.current++;
    const snap = viewTransitionRef.current;
    const el = cursorRef.current;
    if (!el) return;
    el.style.opacity = "0";
    const t = setTimeout(() => {
      if (viewTransitionRef.current === snap) {
        el.style.opacity = "1";
      }
    }, 600);
    return () => clearTimeout(t);
  }, [view]);

  const viewIdx = CRM_VIEWS.findIndex((v) => v.key === view);

  /* ── data ── */
  const inboxItems = [
    {
      name: "Maria Silva",
      msg: "Oi, gostaria de saber sobre o plano...",
      time: "agora",
      unread: true,
      channel: "whatsapp" as const,
    },
    {
      name: "João Santos",
      msg: "Quando posso agendar minha consulta?",
      time: "2m",
      unread: true,
      channel: "whatsapp" as const,
    },
    {
      name: "Ana Costa",
      msg: "Obrigada pelo atendimento!",
      time: "15m",
      unread: false,
      channel: "phone" as const,
    },
    {
      name: "Pedro Lima",
      msg: "Preciso alterar meu plano",
      time: "1h",
      unread: false,
      channel: "whatsapp" as const,
    },
    {
      name: "Carla Nunes",
      msg: "Pode me enviar o boleto?",
      time: "3h",
      unread: false,
      channel: "phone" as const,
    },
  ];

  const messages = [
    {
      from: "lead" as const,
      text: "Oi, gostaria de saber sobre o plano familiar. Quanto custa?",
      time: "10:30",
    },
    {
      from: "lead" as const,
      text: "Vi no site que vocês tem opções a partir de R$89",
      time: "10:30",
    },
    {
      from: "operator" as const,
      text: "Olá Maria! Sim, temos ótimas opções. O plano familiar cobre até 4 dependentes por R$149/mês.",
      time: "10:31",
    },
  ];

  const funnelColumns = [
    {
      title: "Novo Lead",
      color: "bg-blue-500",
      items: [
        { name: "Maria Silva", tag: "Plano Familiar", score: 92 },
        { name: "Carlos Almeida", tag: "Individual", score: 78 },
      ],
    },
    {
      title: "Qualificado",
      color: "bg-amber-500",
      items: [{ name: "João Santos", tag: "Empresarial", score: 85 }],
    },
    {
      title: "Proposta",
      color: "bg-blue-400",
      items: [
        { name: "Ana Costa", tag: "Plano Família+", score: 95 },
        { name: "Pedro Lima", tag: "Individual Pro", score: 88 },
      ],
    },
    {
      title: "Fechado",
      color: "bg-emerald-500",
      items: [{ name: "Lucia Ferreira", tag: "Empresarial", score: 100 }],
    },
  ];

  const aiInsights = [
    {
      label: "Sentimento geral",
      value: "Positivo",
      pct: 87,
      color: "text-emerald-500",
      bg: "bg-emerald-500",
    },
    {
      label: "Intenção de compra",
      value: "Alta",
      pct: 92,
      color: "text-blue-500",
      bg: "bg-blue-500",
    },
    {
      label: "Tempo médio de resposta",
      value: "1m 23s",
      pct: 78,
      color: "text-amber-500",
      bg: "bg-amber-500",
    },
    {
      label: "Score de qualificação",
      value: "A+",
      pct: 95,
      color: "text-blue-400",
      bg: "bg-blue-400",
    },
  ];

  const aiClassifications = [
    { label: "Interessado em plano familiar", confidence: 94, icon: Star },
    {
      label: "Lead quente, pronto para proposta",
      confidence: 91,
      icon: Lightning,
    },
    { label: "Perfil: Decisor", confidence: 87, icon: UserCircle },
    { label: "Canal preferido: WhatsApp", confidence: 96, icon: WhatsappLogo },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/20 via-muted/40 to-muted/20 py-32">
      {/* bg glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] rounded-full opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.5) 0%, rgba(59,130,246,0.1) 50%, transparent 70%)",
            filter: "blur(100px)",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-balance text-3xl font-bold md:text-5xl lg:text-6xl text-foreground tracking-tight">
            Tudo que você precisa,{" "}
            <span className="text-primary">em um só lugar</span>
          </h2>
          <p className="mt-5 text-pretty text-base text-muted-foreground md:text-lg max-w-2xl mx-auto leading-relaxed">
            Gerencie leads, conversas, funil de vendas e análises com
            inteligência artificial, sem sair da plataforma.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center gap-1 rounded-2xl bg-muted/60 backdrop-blur-sm border border-border/40 p-1.5">
            {CRM_VIEWS.map((v, i) => {
              const TabIcon = v.icon;
              const active = i === viewIdx;
              return (
                <button
                  key={v.key}
                  onClick={() => {
                    setView(v.key);
                    setProgress(0);
                    setSubStep(0);
                  }}
                  className={`relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-700 ease-out ${
                    active
                      ? "bg-background text-foreground shadow-lg shadow-black/5"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  <TabIcon
                    size={16}
                    weight={active ? "fill" : "regular"}
                    className={`transition-all duration-700 ${active ? "text-blue-500" : ""}`}
                  />
                  <span className="hidden sm:inline">{v.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blue-500/20 overflow-hidden">
                      <span
                        className="block h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${progress * 100}%`,
                          transition: "width 100ms linear",
                        }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main panel ── */}
        <div className="relative rounded-3xl border border-border/50 bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/[0.04] overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-3 border-b border-border/40 bg-muted/20 px-5 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
              <div className="h-3 w-3 rounded-full bg-green-400/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-1">
                <MagnifyingGlass
                  size={12}
                  className="text-muted-foreground/50"
                />
                <span className="text-[11px] text-muted-foreground/60 font-medium">
                  {getBrand().name} CRM
                </span>
              </div>
            </div>
            <div className="w-[52px]" />
          </div>

          {/* views container with crossfade */}
          <div className="relative min-h-[520px] md:min-h-[480px]">
            {/* ── Smooth cursor overlay ── */}
            <div
              ref={cursorRef}
              className="absolute z-50 pointer-events-none"
              style={{
                left: "12%",
                top: "22%",
                transition:
                  "left 1.8s cubic-bezier(0.25, 0.1, 0.25, 1), top 1.8s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.6s ease",
                opacity: 0,
              }}
            >
              {/* cursor icon */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-lg"
                style={{
                  filter: "drop-shadow(0 2px 8px rgba(59,130,246,0.35))",
                }}
              >
                <path
                  d="M5 3L19 12L12 13L9 20L5 3Z"
                  fill="rgb(59,130,246)"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              {/* click ripple */}
              <div className="absolute top-3 left-3 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                <span className="absolute inset-1 rounded-full bg-blue-500/20" />
              </div>
            </div>

            {/* ═══════ INBOX ═══════ */}
            <div
              className={`absolute inset-0 transition-all duration-1000 ease-out ${view === "inbox" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
            >
              <div className="flex h-full">
                {/* sidebar */}
                <div className="w-full sm:w-[320px] shrink-0 border-r border-border/30">
                  <div className="p-3 border-b border-border/30">
                    <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border/30 px-3 py-2">
                      <MagnifyingGlass
                        size={14}
                        className="text-muted-foreground/50"
                      />
                      <span className="text-[12px] text-muted-foreground/50">
                        Buscar conversas...
                      </span>
                    </div>
                  </div>
                  {inboxItems.map((item, i) => (
                    <div
                      key={item.name}
                      className={`flex items-center gap-3 px-4 py-3.5 border-b border-border/20 transition-all duration-1000 ease-out ${
                        subStep >= 1 && i === 0 ? "bg-blue-500/8" : ""
                      }`}
                      style={{
                        opacity: view === "inbox" ? 1 : 0,
                        transform:
                          view === "inbox"
                            ? "translateX(0)"
                            : "translateX(-20px)",
                        transitionDelay: `${i * 250}ms`,
                      }}
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/90 to-blue-600/90">
                        <UserCircle
                          size={22}
                          className="text-white"
                          weight="fill"
                        />
                        {item.channel === "whatsapp" && (
                          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
                            <WhatsappLogo
                              size={10}
                              className="text-white"
                              weight="fill"
                            />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold text-foreground truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-2">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                          {item.msg}
                        </p>
                      </div>
                      {item.unread && (
                        <div
                          className={`h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 transition-all duration-700 ${subStep >= 2 && i === 0 ? "scale-150 shadow-md shadow-blue-500/50" : "shadow-sm shadow-blue-500/50"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {/* empty state */}
                <div className="hidden sm:flex flex-1 flex-col items-center justify-center gap-4">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/30 transition-all duration-1000 ease-out ${subStep >= 2 ? "scale-95 opacity-60" : ""}`}
                  >
                    <ChatTeardropText
                      size={40}
                      weight="duotone"
                      className="text-muted-foreground/25"
                    />
                  </div>
                  <p
                    className={`text-sm text-muted-foreground/40 font-medium transition-all duration-1000 ${subStep >= 2 ? "opacity-40" : ""}`}
                  >
                    Selecione uma conversa
                  </p>
                </div>
              </div>
            </div>

            {/* ═══════ CONVERSATION ═══════ */}
            <div
              className={`absolute inset-0 transition-all duration-1000 ease-out ${view === "conversation" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
            >
              <div className="flex h-full">
                {/* mini sidebar */}
                <div className="hidden lg:block w-[260px] shrink-0 border-r border-border/30 bg-muted/5">
                  {inboxItems.slice(0, 4).map((item, i) => (
                    <div
                      key={item.name}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-border/20 transition-all duration-700 ${i === 0 ? "bg-blue-500/8 border-l-2 border-l-blue-500" : ""}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-blue-600/80">
                        <UserCircle
                          size={16}
                          className="text-white"
                          weight="fill"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold text-foreground truncate block">
                          {item.name}
                        </span>
                        <p className="text-[10px] text-muted-foreground/60 truncate">
                          {item.msg.slice(0, 25)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* chat area */}
                <div className="flex-1 flex flex-col">
                  {/* conv header */}
                  <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600">
                        <UserCircle
                          size={20}
                          className="text-white"
                          weight="fill"
                        />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">
                          Maria Silva
                        </p>
                        <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                          <WhatsappLogo size={10} weight="fill" /> Online agora
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* AI badge */}
                      <div
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold transition-all duration-1000 ease-out ${subStep >= 1 ? "border-blue-500 bg-blue-500 text-white opacity-100 scale-100" : "border-transparent bg-transparent text-transparent opacity-0 scale-90"}`}
                      >
                        <Brain size={12} weight="fill" /> IA classificou: Lead
                        Quente
                      </div>
                      <button
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-1000 ease-out ${subStep >= 5 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 scale-110" : "bg-muted/40 text-muted-foreground"}`}
                      >
                        <Phone size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                  {/* messages */}
                  <div className="flex-1 p-5 space-y-3 overflow-hidden">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.from === "operator" ? "justify-end" : "justify-start"}`}
                        style={{
                          opacity: subStep >= 1 ? 1 : 0,
                          transform:
                            subStep >= 1 ? "translateY(0)" : "translateY(20px)",
                          transition: `all 1s cubic-bezier(0.16, 1, 0.3, 1) ${i * 400}ms`,
                        }}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.from === "operator" ? "bg-blue-500 text-white rounded-br-lg" : "bg-muted/50 text-foreground rounded-bl-lg"}`}
                        >
                          <p className="text-[12px] leading-relaxed">
                            {msg.text}
                          </p>
                          <p
                            className={`text-[9px] mt-1 text-right ${msg.from === "operator" ? "text-blue-200/70" : "text-muted-foreground/50"}`}
                          >
                            {msg.time}
                          </p>
                        </div>
                      </div>
                    ))}
                    {/* typing indicator */}
                    {subStep >= 1 && subStep < 3 && (
                      <div
                        className="flex justify-end"
                        style={{ animation: "crm-fade-in 1s ease-out" }}
                      >
                        <div className="rounded-2xl rounded-br-lg bg-blue-500/80 px-4 py-3 flex gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full bg-white/60 animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-white/60 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-white/60 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      </div>
                    )}
                    {/* operator reply */}
                    {subStep >= 3 && (
                      <div
                        className="flex justify-end"
                        style={{
                          opacity: subStep >= 3 ? 1 : 0,
                          transform:
                            subStep >= 3 ? "translateY(0)" : "translateY(20px)",
                          transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      >
                        <div className="max-w-[70%] rounded-2xl rounded-br-lg bg-blue-500 text-white px-4 py-2.5">
                          <p className="text-[12px] leading-relaxed">
                            Perfeito! Vou enviar agora a proposta completa com
                            todos os detalhes. 😊
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <p className="text-[9px] text-blue-200/70">10:32</p>
                            <CheckCircle
                              size={10}
                              className="text-blue-200/70"
                              weight="fill"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* input */}
                  <div className="border-t border-border/30 px-5 py-3">
                    <div className="flex items-center gap-3 rounded-xl bg-muted/20 border border-border/30 px-4 py-2.5">
                      <span
                        className={`flex-1 text-[12px] transition-all duration-1000 ${subStep >= 2 ? "text-foreground/60" : "text-muted-foreground/40"}`}
                      >
                        {subStep >= 2
                          ? "Perfeito! Vou enviar agora..."
                          : "Digite uma mensagem..."}
                      </span>
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-1000 ease-out ${subStep >= 3 ? "bg-blue-500 text-white scale-105" : "bg-muted/50 text-muted-foreground"}`}
                      >
                        <PaperPlaneTilt size={14} weight="fill" />
                      </div>
                    </div>
                  </div>
                </div>
                {/* sidebar: AI info panel */}
                <div className="hidden xl:flex w-[240px] shrink-0 flex-col border-l border-border/30 bg-muted/5 p-4 gap-4">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Resumo IA
                  </div>
                  {[
                    { l: "Sentimento", v: "Positivo", c: "text-emerald-500" },
                    { l: "Intenção", v: "Compra", c: "text-blue-500" },
                    { l: "Prioridade", v: "Alta", c: "text-amber-500" },
                  ].map((item, i) => (
                    <div
                      key={item.l}
                      className="transition-all duration-1000 ease-out"
                      style={{
                        opacity: subStep >= 4 ? 1 : 0,
                        transform:
                          subStep >= 4 ? "translateX(0)" : "translateX(20px)",
                        transitionDelay: `${i * 300}ms`,
                      }}
                    >
                      <p className="text-[10px] text-muted-foreground/50 mb-1">
                        {item.l}
                      </p>
                      <p className={`text-[13px] font-bold ${item.c}`}>
                        {item.v}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══════ FUNNEL ═══════ */}
            <div
              className={`absolute inset-0 transition-all duration-1000 ease-out ${view === "funnel" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
            >
              <div className="p-5 sm:p-6 h-full flex flex-col">
                {/* funnel header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <Funnel
                      size={18}
                      weight="duotone"
                      className="text-blue-500"
                    />
                    <h3 className="text-[14px] font-bold text-foreground">
                      Funil de Vendas
                    </h3>
                    <span className="text-[11px] bg-blue-500 text-white px-2.5 py-0.5 rounded-full font-semibold">
                      6 leads
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 transition-all duration-1000 ease-out ${subStep >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
                  >
                    <Brain size={12} weight="fill" className="text-blue-500" />
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                      Auto-classificação IA ativa
                    </span>
                  </div>
                </div>
                {/* columns */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                  {funnelColumns.map((col, colIdx) => (
                    <div
                      key={col.title}
                      className="flex flex-col rounded-2xl bg-muted/20 border border-border/30 overflow-hidden transition-all duration-1000 ease-out"
                      style={{
                        opacity: subStep >= 1 ? 1 : 0,
                        transform:
                          subStep >= 1 ? "translateY(0)" : "translateY(30px)",
                        transitionDelay: `${colIdx * 250}ms`,
                      }}
                    >
                      {/* col header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${col.color}`}
                        />
                        <span className="text-[12px] font-bold text-foreground">
                          {col.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {col.items.length}
                        </span>
                      </div>
                      {/* cards */}
                      <div className="flex-1 p-2 space-y-2">
                        {col.items.map((item, itemIdx) => (
                          <div
                            key={item.name}
                            className="rounded-xl bg-background border border-border/30 p-3 transition-all duration-1000 ease-out hover:shadow-md hover:border-border/60 group"
                            style={{
                              opacity: subStep >= 2 ? 1 : 0,
                              transform:
                                subStep >= 2
                                  ? "translateY(0) scale(1)"
                                  : "translateY(16px) scale(0.96)",
                              transitionDelay: `${colIdx * 200 + itemIdx * 150}ms`,
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[12px] font-semibold text-foreground">
                                {item.name}
                              </span>
                              <DotsSixVertical
                                size={12}
                                className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors duration-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-md">
                                {item.tag}
                              </span>
                              {/* AI score badge */}
                              <div
                                className={`flex items-center gap-1 ml-auto transition-all duration-1000 ease-out ${subStep >= 3 ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
                                style={{
                                  transitionDelay: `${colIdx * 200 + itemIdx * 150 + 400}ms`,
                                }}
                              >
                                <Sparkle
                                  size={10}
                                  weight="fill"
                                  className="text-blue-500"
                                />
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                  {item.score}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* AI auto-move indicator */}
                <div
                  className={`mt-4 flex items-center justify-center gap-3 transition-all duration-1000 ease-out ${subStep >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                >
                  <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500/10 to-blue-400/10 border border-blue-500/20 px-4 py-2">
                    <Brain size={14} weight="fill" className="text-blue-500" />
                    <span className="text-[11px] font-semibold text-foreground/80">
                      IA moveu{" "}
                      <span className="text-blue-500">Maria Silva</span> para{" "}
                      <span className="text-amber-500">Qualificado</span> ,
                      score aumentou para 92%
                    </span>
                    <TrendUp
                      size={14}
                      weight="bold"
                      className="text-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ AI ANALYSIS ═══════ */}
            <div
              className={`absolute inset-0 transition-all duration-1000 ease-out ${view === "ai" ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
            >
              <div className="p-5 sm:p-6 h-full flex flex-col">
                {/* header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                    <Brain size={18} className="text-white" weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-foreground">
                      Análise Inteligente
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Insights automáticos de cada conversa
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 flex-1">
                  {/* Metrics */}
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Métricas da conversa
                    </p>
                    {aiInsights.map((item, i) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-4 transition-all duration-1000 ease-out"
                        style={{
                          opacity: subStep >= 1 ? 1 : 0,
                          transform:
                            subStep >= 1
                              ? "translateX(0)"
                              : "translateX(-24px)",
                          transitionDelay: `${i * 250}ms`,
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-medium text-foreground/80">
                              {item.label}
                            </span>
                            <span
                              className={`text-[12px] font-bold ${item.color}`}
                            >
                              {item.value}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${item.bg} transition-all ease-out`}
                              style={{
                                width: subStep >= 2 ? `${item.pct}%` : "0%",
                                transitionDuration: "1.6s",
                                transitionDelay: `${i * 200}ms`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Classifications */}
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Classificação automática
                    </p>
                    {aiClassifications.map((item, i) => {
                      const CIcon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-3 rounded-xl bg-muted/20 border border-border/30 p-3 transition-all duration-1000 ease-out"
                          style={{
                            opacity: subStep >= 2 ? 1 : 0,
                            transform:
                              subStep >= 2
                                ? "translateX(0) scale(1)"
                                : "translateX(24px) scale(0.95)",
                            transitionDelay: `${i * 250 + 400}ms`,
                          }}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-400/20">
                            <CIcon
                              size={16}
                              weight="fill"
                              className="text-blue-500"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-foreground/80 truncate">
                              {item.label}
                            </p>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 transition-all duration-1000 ease-out ${subStep >= 3 ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
                            style={{ transitionDelay: `${i * 200 + 600}ms` }}
                          >
                            <span className="text-[11px] font-bold text-emerald-500">
                              {item.confidence}%
                            </span>
                            <CheckCircle
                              size={12}
                              weight="fill"
                              className="text-emerald-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI summary */}
                <div
                  className={`mt-5 rounded-2xl bg-gradient-to-r from-blue-500/5 via-blue-400/5 to-emerald-500/5 border border-blue-500/15 p-4 transition-all duration-1000 ease-out ${subStep >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 mt-0.5">
                      <Sparkle size={14} className="text-white" weight="fill" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-foreground mb-1">
                        Recomendação da IA
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Lead com alto potencial de conversão. Recomendo enviar
                        proposta personalizada do{" "}
                        <span className="text-blue-500 font-semibold">
                          Plano Familiar
                        </span>{" "}
                        e agendar ligação para amanhã às 14h. Probabilidade de
                        fechamento:{" "}
                        <span className="text-emerald-500 font-bold">89%</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature pills below */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {[
            { icon: Envelope, text: "Inbox unificado" },
            { icon: ChatTeardropText, text: "Chat em tempo real" },
            { icon: Funnel, text: "Funil inteligente" },
            { icon: Brain, text: "Classificação por IA" },
            { icon: Phone, text: "Ligações integradas" },
            { icon: TrendUp, text: "Análise de sentimento" },
            { icon: Tag, text: "Tags automáticas" },
            { icon: Lightning, text: "Automações" },
          ].map((pill) => {
            const PillIcon = pill.icon;
            return (
              <div
                key={pill.text}
                className="flex items-center gap-2 rounded-full bg-muted/40 border border-border/30 px-4 py-2 transition-all duration-700 hover:bg-muted/60 hover:border-border/50"
              >
                <PillIcon
                  size={14}
                  weight="duotone"
                  className="text-blue-500"
                />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {pill.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes crm-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
