import type { LottieAnimation } from "./lottie-types";
import { readZip } from "./zip";

export const LOTTIE_MEDIA_TYPE = "lottie";

export const LOTTIE_EXTENSIONS = [".json", ".lottie"] as const;

export const LOTTIE_ACCEPT = LOTTIE_EXTENSIONS.join(",");

export type LottieFileFault = "notLottie" | "brokenArchive" | "noAnimation";

export type LottieRead = { ok: true; animation: LottieAnimation } | { ok: false; fault: LottieFileFault };

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const MANIFEST = "manifest.json";
const ANIMATION_FOLDERS = ["animations", "a"];

export function isLottieName(name: string): boolean {
  const lower = name.toLowerCase();
  return LOTTIE_EXTENSIONS.some((extension) => lower.endsWith(extension) && lower.length > extension.length);
}

function positive(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isLottieAnimation(raw: unknown): raw is LottieAnimation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const animation = raw as Record<string, unknown>;
  return positive(animation.fr) && finite(animation.ip) && finite(animation.op) && animation.op > animation.ip && positive(animation.w) && positive(animation.h) && Array.isArray(animation.layers);
}

function parsed(text: string | null): LottieRead {
  if (text === null) return { ok: false, fault: "noAnimation" };
  try {
    const raw: unknown = JSON.parse(text);
    return isLottieAnimation(raw) ? { ok: true, animation: raw } : { ok: false, fault: "notLottie" };
  } catch {
    return { ok: false, fault: "notLottie" };
  }
}

function zipped(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((value, index) => bytes[index] === value);
}

function firstAnimationId(manifest: string | null): string | null {
  if (manifest === null) return null;
  try {
    const raw = JSON.parse(manifest) as { animations?: { id?: unknown }[] };
    const id = raw.animations?.[0]?.id;
    return typeof id === "string" && id !== "" ? id : null;
  } catch {
    return null;
  }
}

async function dotLottie(bytes: Uint8Array): Promise<LottieRead> {
  const archive = readZip(bytes);
  if (!archive) return { ok: false, fault: "brokenArchive" };
  const id = firstAnimationId(await archive.text(MANIFEST));
  if (!id) return { ok: false, fault: "noAnimation" };
  const path = ANIMATION_FOLDERS.map((folder) => `${folder}/${id}.json`).find((candidate) => archive.names().includes(candidate));
  return parsed(path ? await archive.text(path) : null);
}

export async function readLottieFile(bytes: Uint8Array): Promise<LottieRead> {
  if (zipped(bytes)) return dotLottie(bytes);
  return parsed(new TextDecoder().decode(bytes));
}
