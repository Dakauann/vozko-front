"use client";

import { useTranslations } from "next-intl";

import { CheckCircle } from "@/components/icons";
import type { FormBuilderState } from "@/lib/advertising/forms";
import type { AdPage } from "@/lib/advertising/types";

import { AdImage } from "../ad-image";

export function FormPreview({ state, page }: { state: FormBuilderState; page: AdPage }) {
  const t = useTranslations("adsForms.preview");
  const tq = useTranslations("adsForms.questions");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("title")}</p>
      <div className="mx-auto w-full max-w-[300px] rounded-[28px] border border-border-strong bg-muted p-2 shadow-sm" aria-hidden>
        <div className="max-h-[560px] space-y-4 overflow-y-auto rounded-[22px] bg-card px-4 py-5">
          <div className="flex items-center gap-2">
            {page.pictureUrl ? (
              <span className="relative h-8 w-8 overflow-hidden rounded-full">
                <AdImage src={page.pictureUrl} />
              </span>
            ) : (
              <span className="h-8 w-8 rounded-full bg-muted" />
            )}
            <span className="truncate text-xs font-semibold text-foreground">{page.name}</span>
          </div>
          <p className="font-display text-base font-semibold leading-snug text-foreground">{state.headline.trim() || t("headline")}</p>
          {state.higherIntent ? <p className="text-2xs text-muted-foreground">{t("review")}</p> : null}

          <div className="space-y-3">
            {state.questions.length === 0 ? <p className="text-xs text-muted-foreground">{t("noQuestions")}</p> : null}
            {state.questions.map((question) => {
              const label = question.type === "CUSTOM" ? question.label.trim() || t("customUntitled") : tq(question.type);
              const options = question.options.map((option) => option.trim()).filter(Boolean);
              return (
                <div key={question.id} className="space-y-1">
                  <p className="text-2xs font-medium text-muted-foreground">{label}</p>
                  {question.type === "CUSTOM" && options.length > 0 ? (
                    <ul className="space-y-1">
                      {options.map((option, index) => (
                        <li key={`${option}-${index}`} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-foreground">
                          <span className="h-3 w-3 rounded-full border border-control-edge" />
                          {option}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="h-8 rounded-md border border-control-edge bg-card" />
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-2xs text-muted-foreground">
            {t("privacy", { page: page.name })}{" "}
            <span className="font-semibold text-primary-ink underline">{state.privacyText.trim() || t("privacyLink")}</span>
          </p>
          <div className="rounded-md bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">
            {state.higherIntent ? t("review") : t("submit")}
          </div>

          <div className="border-t border-border pt-4 text-center">
            <CheckCircle className="mx-auto h-6 w-6 text-healthy-ink" />
            <p className="mt-2 text-sm font-semibold text-foreground">{state.thankYouTitle.trim() || t("thanksTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{state.thankYouBody.trim() || t("thanksBody")}</p>
            {state.thankYouUrl.trim() ? (
              <div className="mt-3 rounded-md border border-control-edge py-1.5 text-xs font-semibold text-foreground">{t("visit")}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
