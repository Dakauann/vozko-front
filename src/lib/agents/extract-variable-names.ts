const AGENT_VAR_PATTERN = /\{\{(\w+)\}\}/g;

export function extractAgentVariableNames(
  ...texts: string[]
): string[] {
  const seen = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    AGENT_VAR_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = AGENT_VAR_PATTERN.exec(text)) !== null) {
      if (match[1]) seen.add(match[1]);
    }
  }
  return Array.from(seen).sort();
}