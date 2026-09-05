"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "@/components/icons";
import { Link } from "@/i18n/routing";
import styles from "./landing.module.css";
import { Hero, type HeroLabels } from "./hero";
import { StageSection, type StageLabels } from "./stage";
import { FeatureAtlas, type FeatureGroup } from "./feature-atlas";
import { CrmScene, type CrmSceneLabels } from "./scenes/crm-console";
import { KanbanBoardScene, type KanbanSceneLabels } from "./scenes/kanban-board";
import { WorkflowScene, type WorkflowSceneLabels } from "./scenes/workflow-canvas";
import { RouletteScene, type RouletteSceneLabels } from "./scenes/roulette-ring";
import { MemoryScene, type MemorySceneLabels } from "./scenes/lead-memory";
import { AgentScene, type AgentSceneLabels } from "./scenes/agent-forge";
import { CampaignScene, type CampaignSceneLabels } from "./scenes/campaign-fan";
import { KnowledgeScene, type KnowledgeSceneLabels } from "./scenes/knowledge-index";

type StageCopy = {
  scroll: string;
  crm: StageLabels & CrmSceneLabels;
  workflow: StageLabels & WorkflowSceneLabels;
  roulette: StageLabels & RouletteSceneLabels;
  memory: StageLabels & MemorySceneLabels;
  agent: StageLabels & AgentSceneLabels;
  campaign: StageLabels & CampaignSceneLabels;
  knowledge: StageLabels & KnowledgeSceneLabels;
};

export function LandingPage({ brandName }: { brandName: string }) {
  const t = useTranslations("landing");
  const hero = t.raw("hero") as HeroLabels;
  const kanban = t.raw("kanban") as StageLabels & KanbanSceneLabels & { scroll: string };
  const stages = t.raw("stages") as StageCopy;
  const featureGroups = t.raw("atlas.groups") as FeatureGroup[];

  return (
    <main className={styles.root}>
      <a
        href="#conteudo"
        className="sr-only z-[60] bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t("skip")}
      </a>

      <Hero labels={hero} />

      <div id="conteudo">
        <StageSection
          id="atendimento"
          labels={stages.crm}
          scroll={stages.scroll}
          height={430}
          scene={(progress, reduced, palette) => <CrmScene progress={progress} reduced={reduced} labels={stages.crm} palette={palette} />}
        />

        <StageSection
          id="fluxo"
          labels={kanban}
          scroll={kanban.scroll}
          height={365}
          scene={(progress, reduced, palette) => <KanbanBoardScene progress={progress} reduced={reduced} labels={kanban} palette={palette} />}
        />

        <section className={styles.manifesto}>
          <div className={styles.manifestoGrid}>
            <p className={styles.manifestoLabel}>{t("manifesto.eyebrow")}</p>
            <h2>
              {t("manifesto.titleLine1")}
              <br />
              {t("manifesto.titleLine2")}
            </h2>
            <p>{t("manifesto.body", { brandName })}</p>
          </div>
        </section>

        <StageSection
          id="workflows"
          side="right"
          labels={stages.workflow}
          scroll={stages.scroll}
          scene={(progress, reduced, palette) => <WorkflowScene progress={progress} reduced={reduced} labels={stages.workflow} palette={palette} />}
        />
        <StageSection
          id="roulette"
          labels={stages.roulette}
          scroll={stages.scroll}
          scene={(progress, reduced, palette) => <RouletteScene progress={progress} reduced={reduced} labels={stages.roulette} palette={palette} />}
        />
        <StageSection
          id="memory"
          side="right"
          labels={stages.memory}
          scroll={stages.scroll}
          scene={(progress, reduced, palette) => <MemoryScene progress={progress} reduced={reduced} labels={stages.memory} palette={palette} />}
        />
        <StageSection
          id="agentes"
          labels={stages.agent}
          scroll={stages.scroll}
          height={250}
          scene={(progress, reduced, palette) => <AgentScene progress={progress} reduced={reduced} labels={stages.agent} palette={palette} />}
        />
        <StageSection
          id="campanhas"
          side="right"
          labels={stages.campaign}
          scroll={stages.scroll}
          height={250}
          scene={(progress, reduced, palette) => <CampaignScene progress={progress} reduced={reduced} labels={stages.campaign} palette={palette} />}
        />
        <StageSection
          id="conhecimento"
          labels={stages.knowledge}
          scroll={stages.scroll}
          height={250}
          scene={(progress, reduced, palette) => <KnowledgeScene progress={progress} reduced={reduced} labels={stages.knowledge} palette={palette} />}
        />

        <FeatureAtlas eyebrow={t("atlas.eyebrow")} title={t("atlas.title")} body={t("atlas.body")} groups={featureGroups} />

        <section className={styles.finalCta}>
          <div className={styles.finalCtaInner}>
            <p className={styles.finalIndex}>{t("final.eyebrow")}</p>
            <h2>
              {t("final.titleLine1")}
              <br />
              {t("final.titleLine2")}
            </h2>
            <div>
              <p>{t("final.body")}</p>
              <Link href="/register" className={`${styles.button} ${styles.buttonPrimary}`}>
                {t("final.cta")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
