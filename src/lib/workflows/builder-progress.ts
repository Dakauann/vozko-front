export function builderStepLabel(iteration: number, max: number): string {
  return Number.isFinite(max) && max > 0 ? `Passo ${iteration}/${max}` : `Passo ${iteration}`;
}
