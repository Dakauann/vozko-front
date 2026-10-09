const LEGACY_KEY = "studio-renderer";

export function gpuRenderingWanted(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(LEGACY_KEY) !== "legacy";
  } catch {
    return true;
  }
}
