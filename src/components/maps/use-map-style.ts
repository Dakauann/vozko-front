"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { StyleSpecification } from "maplibre-gl";

import {
  applyPatchesToStyle,
  basemapPatches,
  DEFAULT_BOLD_FONT,
  DEFAULT_LABEL_FONT,
  labelBoldFont,
  labelFont,
  labelLanguagePatches,
  type StylePatch,
} from "@/lib/maps/basemap";
import { mapStyleSetting } from "@/lib/maps/config";
import { basemapPalette, MAP_TOKEN_NAMES, mapPalette, type MapPalette, type MapTheme, type TokenReader } from "@/lib/maps/palette";
import { loadBaseStyle } from "@/lib/maps/style-loader";

export type MapStyleStatus = "loading" | "ready" | "error";

export type MapStyleFailure = "configuration" | "unavailable" | "theme";

export interface MapStyleState {
  status: MapStyleStatus;
  failure: MapStyleFailure | null;
  cause: unknown;
  style: StyleSpecification | null;
  basemapPatches: StylePatch[];
  palette: MapPalette | null;
  font: string[];
  boldFont: string[];
  retry: () => void;
}

interface ThemeSnapshot {
  signature: string;
  theme: MapTheme;
  read: TokenReader;
}

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;
let themeSnapshot: ThemeSnapshot | null = null;

function readThemeSnapshot(): ThemeSnapshot {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const theme: MapTheme = root.classList.contains("dark") ? "dark" : "light";
  const values = new Map(MAP_TOKEN_NAMES.map((name) => [name, styles.getPropertyValue(name).trim()]));
  return {
    signature: `${theme}|${[...values.values()].join("|")}`,
    theme,
    read: (name) => values.get(name) ?? "",
  };
}

function refreshThemeSnapshot(): boolean {
  const next = readThemeSnapshot();
  if (themeSnapshot && themeSnapshot.signature === next.signature) return false;
  themeSnapshot = next;
  return true;
}

function subscribeToTheme(onChange: () => void): () => void {
  themeListeners.add(onChange);
  if (!themeObserver) {
    refreshThemeSnapshot();
    themeObserver = new MutationObserver(() => {
      if (refreshThemeSnapshot()) themeListeners.forEach((listener) => listener());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  }
  return () => {
    themeListeners.delete(onChange);
    if (themeListeners.size > 0) return;
    themeObserver?.disconnect();
    themeObserver = null;
    themeSnapshot = null;
  };
}

function currentThemeSnapshot(): ThemeSnapshot {
  if (!themeSnapshot) themeSnapshot = readThemeSnapshot();
  return themeSnapshot;
}

function serverThemeSnapshot(): null {
  return null;
}

interface LoadedStyle {
  url: string;
  attempt: number;
  style: StyleSpecification | null;
  failed: boolean;
  error?: unknown;
}

function idle(status: MapStyleStatus, failure: MapStyleFailure | null, retry: () => void, cause: unknown = null): MapStyleState {
  return { status, failure, cause, style: null, basemapPatches: [], palette: null, font: DEFAULT_LABEL_FONT, boldFont: DEFAULT_BOLD_FONT, retry };
}

function missingTokens(snapshot: ThemeSnapshot): string[] {
  return MAP_TOKEN_NAMES.filter((name) => snapshot.read(name) === "");
}

export const DEFAULT_MAP_LANGUAGE = "pt";

export function useMapStyle(language: string = DEFAULT_MAP_LANGUAGE): MapStyleState {
  const setting = mapStyleSetting();
  const url = setting.ok ? setting.url : null;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedStyle | null>(null);
  const snapshot = useSyncExternalStore<ThemeSnapshot | null>(subscribeToTheme, currentThemeSnapshot, serverThemeSnapshot);

  useEffect(() => {
    if (url === null) return;
    let cancelled = false;
    loadBaseStyle(url)
      .then((style) => {
        if (!cancelled) setLoaded({ url, attempt, style, failed: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ url, attempt, style: null, failed: true, error });
      });
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const current = loaded && loaded.url === url && loaded.attempt === attempt ? loaded : null;
  const base = current?.style ?? null;

  const themed = useMemo(() => {
    if (!base || !snapshot) return null;
    const basemap = basemapPalette(snapshot.theme, snapshot.read);
    const palette = mapPalette(snapshot.read, snapshot.theme);
    if (!basemap || !palette) return null;
    const patches = [...basemapPatches(base.layers, basemap), ...labelLanguagePatches(base.layers, language)];
    return { patches, palette, style: applyPatchesToStyle(base, patches), font: labelFont(base.layers), boldFont: labelBoldFont(base.layers) };
  }, [base, snapshot, language]);

  if (url === null) return idle("error", "configuration", retry, setting);
  if (current?.failed) return idle("error", "unavailable", retry, current.error);
  if (base && snapshot && !themed) return idle("error", "theme", retry, missingTokens(snapshot));
  if (!themed) return idle("loading", null, retry);
  return {
    status: "ready",
    failure: null,
    cause: null,
    style: themed.style,
    basemapPatches: themed.patches,
    palette: themed.palette,
    font: themed.font,
    boldFont: themed.boldFont,
    retry,
  };
}
