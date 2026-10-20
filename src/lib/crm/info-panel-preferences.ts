const KEY_PREFIX = "crm.infoPanel";

export const INFO_PANEL_TABS = ["contact", "group", "attendance", "insights", "memories"] as const;

export type InfoPanelTab = (typeof INFO_PANEL_TABS)[number];

export interface InfoPanelPreferences {
  open: boolean;
  tab: InfoPanelTab;
}

export const DEFAULT_INFO_PANEL: InfoPanelPreferences = { open: false, tab: "contact" };

function isInfoPanelTab(value: unknown): value is InfoPanelTab {
  return typeof value === "string" && (INFO_PANEL_TABS as readonly string[]).includes(value);
}

export function infoPanelPreferencesKey(viewerId: string | null): string | null {
  return viewerId ? `${KEY_PREFIX}.${viewerId}` : null;
}

export function parseInfoPanelPreferences(raw: string | null): InfoPanelPreferences {
  if (!raw) return DEFAULT_INFO_PANEL;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return DEFAULT_INFO_PANEL;
  }
  if (!decoded || typeof decoded !== "object") return DEFAULT_INFO_PANEL;
  const { open, tab } = decoded as Record<string, unknown>;
  return {
    open: typeof open === "boolean" ? open : DEFAULT_INFO_PANEL.open,
    tab: isInfoPanelTab(tab) ? tab : DEFAULT_INFO_PANEL.tab,
  };
}

export function readInfoPanelPreferences(storage: Pick<Storage, "getItem"> | null, key: string): InfoPanelPreferences {
  try {
    return parseInfoPanelPreferences(storage?.getItem(key) ?? null);
  } catch {
    return DEFAULT_INFO_PANEL;
  }
}

export function writeInfoPanelPreferences(storage: Pick<Storage, "setItem"> | null, key: string, preferences: InfoPanelPreferences): void {
  try {
    storage?.setItem(key, JSON.stringify(preferences));
  } catch {
    return;
  }
}
