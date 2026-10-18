export function metadataKeyOf(label: string): string | null {
  const key = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key === "" ? null : key;
}
