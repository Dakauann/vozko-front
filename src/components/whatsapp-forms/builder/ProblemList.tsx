"use client";

import { useTranslations } from "next-intl";

import { CheckCircle } from "@/components/icons";
import { findBlock, screenIndex } from "@/lib/whatsapp-forms/document-edit";
import type { Document, Problem } from "@/lib/whatsapp-forms/types";

import { useProblemText } from "../use-form-text";

export function problemPlace(document: Document, problem: Problem, words: { form: string; screen: (n: number, title: string) => string }): string {
  const index = problem.screen ? screenIndex(document, problem.screen) : -1;
  const screen = index >= 0 ? document.screens[index] : null;
  const block = problem.block ? findBlock(document, problem.block) : null;
  const blockName = block?.field?.label || block?.display?.text || "";
  const parts = [screen ? words.screen(index + 1, screen.title) : words.form, blockName].filter(Boolean);
  return parts.join(" › ");
}

export function ProblemList({
  document,
  problems,
  onJump,
}: {
  document: Document;
  problems: readonly Problem[];
  onJump: (problem: Problem) => void;
}) {
  const t = useTranslations("whatsappForms.builder.problems");
  const text = useProblemText();
  if (problems.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle className="h-4 w-4 text-healthy" weight="fill" />
        {t("none")}
      </p>
    );
  }
  const words = { form: t("form"), screen: (n: number, title: string) => t("screen", { n, title: title || "" }) };
  return (
    <section aria-label={t("title", { count: problems.length })} className="space-y-2">
      <h2 className="text-xs font-semibold text-foreground">{t("title", { count: problems.length })}</h2>
      <ul className="space-y-1">
        {problems.map((problem, index) => (
          <li key={`${problem.screen ?? ""}-${problem.block ?? ""}-${problem.property ?? ""}-${problem.code}-${index}`}>
            <button
              type="button"
              onClick={() => onJump(problem)}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <span className="min-w-0">
                <span className="block text-xs text-foreground">{text(problem)}</span>
                <span className="block truncate text-2xs text-muted-foreground">{problemPlace(document, problem, words)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
