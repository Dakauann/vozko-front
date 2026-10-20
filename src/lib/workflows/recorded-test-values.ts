import type { RunDetail } from "./types";

const LAST_PREFIX = "_last_";
const NODE_PREFIX = "_node_";

function nestedValue(root: unknown, path: readonly string[]): unknown {
  let current = root;
  for (const part of path) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stateValue(state: Record<string, unknown>, key: string): unknown {
  if (key in state) return state[key];
  if (!key.includes(".")) return undefined;
  const [root, ...path] = key.split(".");
  return nestedValue(state[root], path);
}

export function recordedStepValues(detail: RunDetail, stepIndex: number): (key: string) => unknown {
  const before = detail.logs.slice(0, Math.max(stepIndex, 0)).reverse();
  const state = detail.run.state ?? {};

  const lastOutput = (field: string): unknown => {
    for (const step of before) {
      if (step.output && field in step.output) return step.output[field];
    }
    return undefined;
  };

  const nodeOutput = (key: string): unknown => {
    for (const step of before) {
      const whole = `${NODE_PREFIX}${step.nodeId}`;
      if (key === whole && step.output) return step.output;
      if (!key.startsWith(`${whole}_`) || !step.output) continue;
      const field = key.slice(whole.length + 1);
      if (field in step.output) return step.output[field];
    }
    return undefined;
  };

  return (key) => {
    const fromSteps = key.startsWith(LAST_PREFIX)
      ? lastOutput(key.slice(LAST_PREFIX.length))
      : key.startsWith(NODE_PREFIX)
        ? nodeOutput(key)
        : undefined;
    return fromSteps === undefined ? stateValue(state, key) : fromSteps;
  };
}
