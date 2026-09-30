const SHORT_ID = /^n(\d+)$/;

export function nextShortNodeId(existingIds: Iterable<string>): string {
  let highest = 0;
  for (const id of existingIds) {
    const match = SHORT_ID.exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `n${highest + 1}`;
}
