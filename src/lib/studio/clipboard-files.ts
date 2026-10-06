function isImage(file: File | null): file is File {
  return file !== null && file.type.startsWith("image/");
}

function sameFile(a: File, b: File): boolean {
  return a === b || (a.name === b.name && a.size === b.size && a.type === b.type);
}

export function imageFilesFrom(data: Pick<DataTransfer, "items" | "files">): File[] {
  const fromItems = Array.from(data.items ?? [])
    .filter((entry) => entry.kind === "file")
    .map((entry) => entry.getAsFile());
  const found: File[] = [];
  for (const candidate of [...fromItems, ...Array.from(data.files ?? [])]) {
    if (isImage(candidate) && !found.some((seen) => sameFile(seen, candidate))) found.push(candidate);
  }
  return found;
}
