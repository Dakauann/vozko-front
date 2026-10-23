"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { stepNeighbours } from "@/lib/campaign-wizard/steps";

import { WizardStepBar } from "./WizardStepBar";

export interface WizardNavProps<S extends string> {
  steps: readonly S[];
  current: S;
  labelOf: (step: S) => string;
  nextLabelOf: (step: S) => string;
  onGo: (step: S) => void;
  enabled: boolean;
}

export function WizardNav<S extends string>({ steps, current, labelOf, nextLabelOf, onGo, enabled }: WizardNavProps<S>) {
  const t = useTranslations("campaignWizard");
  const { previous, next } = stepNeighbours(steps, current);
  return (
    <div className="sticky top-12 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-1 py-2">
      <WizardStepBar steps={steps} current={current} labelOf={labelOf} onSelect={onGo} enabled={enabled} />
      <div className="flex items-center gap-2">
        {previous ? <Button variant="ghost" size="sm" title={t("previous")} icon={<ArrowLeft className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => onGo(previous)} /> : null}
        {next ? (
          <Button variant="secondary" size="sm" title={nextLabelOf(next)} icon={<ArrowRight className="h-4 w-4" />} iconVisible iconSide="right" disabled={!enabled} onClick={() => onGo(next)} />
        ) : null}
      </div>
    </div>
  );
}

export interface WizardFooterNextProps<S extends string> {
  steps: readonly S[];
  current: S;
  nextLabelOf: (step: S) => string;
  onGo: (step: S) => void;
  enabled: boolean;
}

export function WizardFooterNext<S extends string>({ steps, current, nextLabelOf, onGo, enabled }: WizardFooterNextProps<S>) {
  const { next } = stepNeighbours(steps, current);
  if (!next) return null;
  return (
    <div className="flex justify-end border-t border-border pt-4">
      <Button variant="primary" title={nextLabelOf(next)} icon={<ArrowRight className="h-4 w-4" />} iconVisible iconSide="right" disabled={!enabled} onClick={() => onGo(next)} />
    </div>
  );
}
