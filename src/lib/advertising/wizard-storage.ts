import { emptyAdForm, emptyWizardForm, type WizardForm } from "@/lib/advertising/draft";
import type { WizardStep } from "@/lib/advertising/wizard-issues";

const STORAGE_VERSION = 2;

export interface StoredWizard {
  form: WizardForm;
  step: WizardStep;
  savedAt: string;
}

export function wizardStorageKey(workspaceId: string): string {
  return `advertising:wizard:${workspaceId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STEPS: WizardStep[] = ["objective", "campaign", "adSet", "ads", "review"];

export function serializeWizard(form: WizardForm, step: WizardStep, now: Date): string {
  return JSON.stringify({ version: STORAGE_VERSION, form, step, savedAt: now.toISOString() });
}

export function parseStoredWizard(raw: string | null): StoredWizard | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !isRecord(parsed.form)) return null;
  const stored = parsed.form;
  if (typeof stored.accountId !== "string" || !Array.isArray(stored.ads) || !isRecord(stored.targeting)) return null;
  const base = emptyWizardForm(stored.accountId);
  const ads = stored.ads.filter(isRecord).map((ad) => ({ ...emptyAdForm(), ...ad })) as WizardForm["ads"];
  const form = { ...base, ...stored, ads: ads.length > 0 ? ads : base.ads } as WizardForm;
  const step = STEPS.includes(parsed.step as WizardStep) ? (parsed.step as WizardStep) : "objective";
  return { form, step, savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "" };
}

export function readWizard(workspaceId: string): StoredWizard | null {
  try {
    return parseStoredWizard(window.localStorage.getItem(wizardStorageKey(workspaceId)));
  } catch {
    return null;
  }
}

export function writeWizard(workspaceId: string, form: WizardForm, step: WizardStep): void {
  try {
    window.localStorage.setItem(wizardStorageKey(workspaceId), serializeWizard(form, step, new Date()));
  } catch {}
}

export function clearWizard(workspaceId: string): void {
  try {
    window.localStorage.removeItem(wizardStorageKey(workspaceId));
  } catch {}
}

export interface WizardEntry {
  accountId: string | null;
  adId: string | null;
  campaignId: string | null;
  adSetId: string | null;
}

export function storedMatchesEntry(stored: StoredWizard, entry: WizardEntry): boolean {
  const form = stored.form;
  if (entry.adId) return form.mode === "creative" && form.editAdId === entry.adId;
  if (entry.adSetId) return form.mode === "adSet" && form.adSetParent?.metaId === entry.adSetId;
  if (entry.campaignId) return form.mode === "campaign" && form.campaignParent?.metaId === entry.campaignId;
  if (form.mode === "creative") return false;
  if (entry.accountId) return form.accountId === entry.accountId;
  return true;
}
