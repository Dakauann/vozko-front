"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { paletteForCategory, type DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import { useDraftExitVerdict } from "@/components/whatsapp/exit/use-template-exit";
import { validateDraftMessage, type DraftMessageProblems, type TemplateDraftPurpose } from "@/lib/whatsapp-templates/draft";
import { applyLeadExit, draftVerdictRequest, withoutExitSetup, type LeadExitPlan } from "@/lib/whatsapp-templates/exit-draft";
import type { TemplateCategory } from "@/lib/whatsapp-templates/types";

interface TemplateDraftSetup {
  purpose: TemplateDraftPurpose;
  initialComponents: DraggableComponent[];
  initialCategory: TemplateCategory;
}

function prunedFor(category: TemplateCategory) {
  const keepsOTP = category === "AUTHENTICATION";
  return (comp: DraggableComponent): DraggableComponent => {
    if (keepsOTP && comp.type === "FOOTER") return withoutExitSetup(comp);
    if (comp.type !== "BUTTONS" || !comp.data.buttons) return comp;
    const kept = comp.data.buttons.filter((btn) => (keepsOTP ? btn.type === "OTP" : btn.type !== "OTP"));
    if (kept.length === comp.data.buttons.length) return comp;
    return { ...comp, data: { ...comp.data, buttons: kept } };
  };
}

export function useTemplateDraft({ purpose, initialComponents, initialCategory }: TemplateDraftSetup) {
  const t = useTranslations("whatsappTemplates");
  const [components, setComponents] = useState<DraggableComponent[]>(initialComponents);
  const [selected, setSelected] = useState<DraggableComponent | null>(null);
  const [category, setCategory] = useState<TemplateCategory>(initialCategory);
  const [problems, setProblems] = useState<DraftMessageProblems>({});
  const [choosingExit, setChoosingExit] = useState(false);

  const exitVerdict = useDraftExitVerdict(draftVerdictRequest(components, category));

  const changeCategory = (next: TemplateCategory) => {
    setCategory(next);
    const prune = prunedFor(next);
    const allowed = new Set(paletteForCategory(next).map((p) => p.type));
    setComponents((current) => current.filter((c) => allowed.has(c.type)).map(prune));
    setSelected((current) => {
      if (!current) return current;
      if (!allowed.has(current.type)) return null;
      return prune(current);
    });
  };

  const updateComponent = (updated: DraggableComponent) => {
    setComponents((current) => current.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

  const check = (): DraftMessageProblems => {
    const found = validateDraftMessage(components, category, t);
    setProblems(found);
    return found;
  };

  const applyExitPlan = (plan: LeadExitPlan): DraggableComponent[] => {
    const next = applyLeadExit(components, plan, (prefix) => `${prefix}-${crypto.randomUUID()}`);
    setComponents(next);
    setSelected(null);
    setChoosingExit(false);
    return next;
  };

  return {
    purpose,
    components,
    setComponents,
    selected,
    setSelected,
    category,
    changeCategory,
    updateComponent,
    problems,
    check,
    choosingExit,
    setChoosingExit,
    applyExitPlan,
    exitVerdict,
  };
}

export type TemplateDraft = ReturnType<typeof useTemplateDraft>;
