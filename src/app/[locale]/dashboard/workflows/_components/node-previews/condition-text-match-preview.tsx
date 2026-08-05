"use client";

import { DecisionBlock } from "./decision-block";

// condition_text_match: routes an input by matching cases (switch/case). The
// cases themselves are the node's output rows; here we show what's being routed.
export function ConditionTextMatchPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const text = ((config.text as string) || "{{message}}").trim() || "{{message}}";
  const mode =
    (config.match_mode as string) === "contains" ? "contém" : "exato";
  const cases = Array.isArray(config.cases) ? config.cases : [];
  const n = cases.length;
  return (
    <DecisionBlock>
      {text}
      <span className="ml-1 font-sans text-[11px] text-muted-foreground">
        · {mode} · {n} caso{n === 1 ? "" : "s"}
      </span>
    </DecisionBlock>
  );
}
