export interface StepNeighbours<S extends string> {
  previous: S | null;
  next: S | null;
}

export function stepNeighbours<S extends string>(steps: readonly S[], current: S): StepNeighbours<S> {
  const index = steps.indexOf(current);
  return {
    previous: index > 0 ? steps[index - 1] : null,
    next: index >= 0 && index < steps.length - 1 ? steps[index + 1] : null,
  };
}

export function stepOf<S extends string>(steps: readonly S[], value: string | null | undefined, fallback: S): S {
  return steps.find((step) => step === value) ?? fallback;
}

export type SendMode = "now" | "schedule" | "ready";

export const SEND_MODES: readonly SendMode[] = ["now", "schedule", "ready"];
