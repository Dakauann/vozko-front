"use client";

import { useTranslations } from "next-intl";

import type { LottieRefusal } from "../use-lottie-import";

export function LottieRefusalNotice({ refusal, onDismiss }: { refusal: LottieRefusal; onDismiss: () => void }) {
  const t = useTranslations("studio.video.media");
  const gaps = useTranslations("studio.lottie.gaps");
  return (
    <div role="alert" data-lottie-refusal className="notice notice-fault space-y-1.5 px-2 py-1.5 text-xs">
      <p className="notice-ink font-medium">{"fault" in refusal ? t(`lottieFaults.${refusal.fault}`) : t("lottieRefused")}</p>
      {"gaps" in refusal ? (
        <ul className="list-disc space-y-0.5 pl-4">
          {refusal.gaps.map((gap) => (
            <li key={`${gap.code}:${gap.where}`}>
              <span className="font-medium">{gap.where}</span>: {gaps(gap.code)}
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={onDismiss} className="rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t("dismiss")}
      </button>
    </div>
  );
}
