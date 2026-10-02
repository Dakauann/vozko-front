"use client";

import { useTranslations } from "next-intl";

import { RadioGroup } from "@/components/ui/radio-group";
import type { AdDevice, AdPlacements } from "@/lib/advertising/draft-types";
import { placementWarnings, positionNeedsFeed, togglePlatform, togglePosition } from "@/lib/advertising/wizard-routes";

import { CheckRow, ChoiceRow, Hint } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

const DEVICES: AdDevice[] = ["mobile", "desktop"];

export function PlacementsSection() {
  const t = useTranslations("adsWizard.placements");
  const labels = useWizardLabels();
  const { form, update, options, issues } = useWizard();
  const placements = form.placements;
  const catalog = options.placements;
  const platforms = placements.platforms ?? [];
  const warnings = placementWarnings(placements, form.destination);

  const set = (next: AdPlacements) => update((current) => ({ ...current, placements: next }));

  const chooseMode = (mode: string) => {
    if (mode === "automatic") {
      set({ automatic: true });
      return;
    }
    const all = Object.keys(catalog);
    set({ automatic: false, platforms: all, positions: Object.fromEntries(all.map((platform) => [platform, [...catalog[platform]]])) });
  };

  const toggleDevice = (device: AdDevice, on: boolean) => {
    const devices = placements.devices ?? [];
    set({ ...placements, devices: on ? [...devices, device] : devices.filter((candidate) => candidate !== device) });
  };

  return (
    <div className="space-y-3">
      <RadioGroup value={placements.automatic ? "automatic" : "manual"} onValueChange={chooseMode} className="grid gap-2 sm:grid-cols-2">
        <ChoiceRow value="automatic" title={t("automatic")} hint={t("automaticHint")} />
        <ChoiceRow value="manual" title={t("manual")} hint={t("manualHint")} />
      </RadioGroup>
      {!placements.automatic ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(catalog).map(([platform, positions]) => {
              const selected = placements.positions?.[platform] ?? [];
              const hasFeed = selected.includes("feed");
              return (
                <fieldset key={platform} className="space-y-1 rounded-[--radius] border border-border px-3 py-2">
                  <legend className="sr-only">{labels.placement(platform)}</legend>
                  <CheckRow
                    checked={platforms.includes(platform)}
                    title={labels.placement(platform)}
                    onChange={(on) => set(togglePlatform(placements, platform, positions, on))}
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
                          onChange={(on) => set(togglePosition(placements, platform, position, on))}
                        />
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
          <div className="space-y-1">
            <p className="legend">{t("devices")}</p>
            <div className="flex flex-wrap gap-4">
              {DEVICES.map((device) => (
                <CheckRow
                  key={device}
                  checked={(placements.devices ?? []).includes(device)}
                  title={t(`deviceNames.${device}`)}
                  onChange={(on) => toggleDevice(device, on)}
                />
              ))}
            </div>
            <Hint>{t("devicesHint")}</Hint>
          </div>
          {warnings.map((warning) => (
            <Hint key={warning} tone="warning">
              {t(`warnings.${warning}`)}
            </Hint>
          ))}
        </div>
      ) : null}
      <FieldIssues issues={issues} field="adSet.placements" nested />
    </div>
  );
}
