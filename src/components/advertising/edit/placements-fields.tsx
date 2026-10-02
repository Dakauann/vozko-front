"use client";

import { useTranslations } from "next-intl";

import { RadioGroup } from "@/components/ui/radio-group";
import { CheckRow, ChoiceRow, Hint } from "@/components/advertising/wizard/choice-row";
import { useWizardLabels } from "@/components/advertising/wizard/use-wizard-labels";
import type { AdDraftDestination, AdPlacements } from "@/lib/advertising/draft-types";
import { manualPlacements } from "@/lib/advertising/edit";
import { issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import { placementWarnings, positionNeedsFeed, togglePlatform, togglePosition } from "@/lib/advertising/wizard-routes";

import { IssueList } from "../field-issue";

export function PlacementsFields({
  placements,
  catalog,
  destination,
  expected,
  onChange,
}: {
  placements: AdPlacements;
  catalog: Record<string, string[]>;
  destination: string;
  expected: ExpectedIssues;
  onChange: (placements: AdPlacements) => void;
}) {
  const t = useTranslations("adsManager.edit.placements");
  const labels = useWizardLabels();
  const platforms = placements.platforms ?? [];
  const warnings = placementWarnings(placements, destination as AdDraftDestination);

  return (
    <div className="space-y-3">
      <RadioGroup
        value={placements.automatic ? "automatic" : "manual"}
        onValueChange={(mode) => onChange(mode === "automatic" ? { automatic: true, devices: placements.devices } : manualPlacements(placements, catalog))}
        className="grid gap-2 sm:grid-cols-2"
      >
        <ChoiceRow value="automatic" title={t("automatic")} hint={t("automaticHint")} />
        <ChoiceRow value="manual" title={t("manual")} hint={t("manualHint")} />
      </RadioGroup>
      {!placements.automatic ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(catalog).map(([platform, positions]) => {
            const selected = placements.positions?.[platform] ?? [];
            const hasFeed = selected.includes("feed");
            return (
              <fieldset key={platform} className="space-y-1 rounded-[--radius] border border-border px-3 py-2">
                <legend className="sr-only">{labels.placement(platform)}</legend>
                <CheckRow
                  checked={platforms.includes(platform)}
                  title={labels.placement(platform)}
                  onChange={(on) => onChange(togglePlatform(placements, platform, positions, on))}
                />
                <div className="space-y-0.5 border-t border-border pl-6 pt-1">
                  {positions.map((position) => {
                    const blocked = positionNeedsFeed(platform, position) && !hasFeed;
                    return (
                      <CheckRow
                        key={position}
                        checked={selected.includes(position)}
                        disabled={blocked}
                        title={labels.position(position)}
                        hint={blocked ? t("needsFeed") : undefined}
                        onChange={(on) => onChange(togglePosition(placements, platform, position, on))}
                      />
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      ) : null}
      {warnings.map((warning) => (
        <Hint key={warning} tone="warning">
          {t(`warnings.${warning}`)}
        </Hint>
      ))}
      <IssueList namespace="adsManager" issues={issuesUnder(expected, "placements")} />
    </div>
  );
}
