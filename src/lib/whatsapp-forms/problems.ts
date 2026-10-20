import type { Problem } from "./types";

export interface ProblemIndex {
  byBlock: Map<string, Problem[]>;
  byScreen: Map<string, Problem[]>;
  general: Problem[];
  flaggedBlocks: Set<string>;
  flaggedScreens: Set<string>;
}

function push(map: Map<string, Problem[]>, key: string, problem: Problem) {
  const list = map.get(key);
  if (list) list.push(problem);
  else map.set(key, [problem]);
}

export function indexProblems(problems: readonly Problem[]): ProblemIndex {
  const byBlock = new Map<string, Problem[]>();
  const byScreen = new Map<string, Problem[]>();
  const general: Problem[] = [];
  const flaggedScreens = new Set<string>();
  for (const problem of problems) {
    if (problem.block) push(byBlock, problem.block, problem);
    else if (problem.screen) push(byScreen, problem.screen, problem);
    else general.push(problem);
    if (problem.screen) flaggedScreens.add(problem.screen);
  }
  return { byBlock, byScreen, general, flaggedBlocks: new Set(byBlock.keys()), flaggedScreens };
}

export function propertyProblems(index: ProblemIndex, target: { block?: string; screen?: string }, property: string): Problem[] {
  const list = target.block ? index.byBlock.get(target.block) : target.screen ? index.byScreen.get(target.screen) : index.general;
  return (list ?? []).filter((problem) => problem.property === property || (property === "" && !problem.property));
}
