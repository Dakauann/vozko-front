export type ActionState<R extends string = string> = { enabled: true } | { enabled: false; reason: R };

export const READY: { enabled: true } = { enabled: true };

export function blocked<R extends string>(reason: R): ActionState<R> {
  return { enabled: false, reason };
}

export function firstBlocker<R extends string>(checks: readonly (readonly [boolean, R])[]): ActionState<R> {
  const failed = checks.find(([fails]) => fails);
  return failed ? blocked(failed[1]) : READY;
}

export function reasonOf<R extends string>(state: ActionState<R>): R | null {
  return state.enabled ? null : state.reason;
}
