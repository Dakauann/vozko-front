export function isNewerVersion(candidate: number | undefined, than: number | undefined): boolean {
  return candidate !== undefined && (than === undefined || candidate > than);
}
