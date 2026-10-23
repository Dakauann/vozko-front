export function clipboardFiles(clipboardData: DataTransfer): File[] {
  if (clipboardData.files.length > 0) return Array.from(clipboardData.files);
  return Array.from(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}
