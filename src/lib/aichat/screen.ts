export const SCREEN_COMMANDS = ["read", "edit", "look", "resolve_source", "follow_job", "export", "listen", "save_preset", "create_project"] as const;

export type ScreenCommandName = (typeof SCREEN_COMMANDS)[number];

export interface ScreenCommand {
  id: string;
  name: ScreenCommandName;
  projectId: string;
  args?: unknown;
  threadId?: string;
  claim?: () => Promise<boolean>;
}

export interface ScreenError {
  code: string;
  message: string;
}

export type ScreenTarget =
  | { kind: "artboard"; artboardId: string; n: number; name?: string }
  | { kind: "artboards" }
  | { kind: "moments"; fromMs: number; toMs: number }
  | { kind: "media" };

export type SubjectTarget = ScreenTarget & { projectId: string };

export type ScreenReply = { ok: true; data?: unknown; images?: string[]; target?: ScreenTarget } | { ok: false; error: ScreenError; data?: unknown };

export type ScreenHandler = (command: ScreenCommand) => Promise<ScreenReply>;

export const MAX_SCREEN_MESSAGE = 4000;

export function screenOk(data?: unknown, images?: string[], target?: ScreenTarget): ScreenReply {
  return { ok: true, data, ...(images && images.length > 0 ? { images } : {}), ...(target ? { target } : {}) };
}

export function screenRefusal(code: string, message: string, data?: unknown): ScreenReply {
  const clean = /^[a-z][a-z0-9_]{0,63}$/.test(code) ? code : "refused";
  return { ok: false, error: { code: clean, message: message.slice(0, MAX_SCREEN_MESSAGE) }, ...(data !== undefined ? { data } : {}) };
}

export function isScreenCommand(value: unknown): value is ScreenCommand {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScreenCommand>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.projectId === "string" &&
    (SCREEN_COMMANDS as readonly string[]).includes(candidate.name ?? "")
  );
}

export interface ScreenRegistry {
  register: (projectId: string, handler: ScreenHandler) => () => void;
  run: (command: ScreenCommand) => Promise<ScreenReply>;
  has: (projectId: string) => boolean;
}

export const NO_EDITOR_MESSAGE = "o projeto não está aberto nesta aba; peça ao usuário para abrir o projeto no Estúdio";
export const NO_CREATOR_MESSAGE = "esta aba não pode criar o projeto agora";
export const EDITOR_GRACE_MS = 3000;

async function runSafely(handler: ScreenHandler, command: ScreenCommand): Promise<ScreenReply> {
  try {
    return await handler(command);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return screenRefusal("editor_failed", `o editor falhou ao executar o pedido: ${detail}`);
  }
}

export function routeScreenCommand(command: ScreenCommand, editors: ScreenHandler, creator: ScreenHandler | null): Promise<ScreenReply> {
  if (command.name !== "create_project") return editors(command);
  if (!creator) return Promise.resolve(screenRefusal("no_editor", NO_CREATOR_MESSAGE));
  return runSafely(creator, command);
}

export interface TabLocks {
  request: <T>(key: string, options: { ifAvailable: true }, callback: (lock: unknown) => Promise<T>) => Promise<T>;
}

export function browserLocks(): TabLocks | undefined {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return undefined;
  return navigator.locks as unknown as TabLocks;
}

export function oncePerTabs(commandId: string, run: () => Promise<ScreenReply>, locks: TabLocks | undefined): Promise<ScreenReply> {
  if (!locks) return run();
  return locks.request(`elo-screen:${commandId}`, { ifAvailable: true }, (lock) => (lock ? run() : Promise.resolve(screenRefusal("no_editor", NO_CREATOR_MESSAGE))));
}

export function createScreenRegistry(): ScreenRegistry {
  const handlers = new Map<string, ScreenHandler>();
  const arrivals = new Map<string, Set<() => void>>();

  const handlerFor = (projectId: string): Promise<ScreenHandler | null> => {
    const present = handlers.get(projectId);
    if (present) return Promise.resolve(present);
    return new Promise((resolve) => {
      const waiting = arrivals.get(projectId) ?? new Set<() => void>();
      arrivals.set(projectId, waiting);
      const settle = () => {
        clearTimeout(timer);
        waiting.delete(settle);
        if (waiting.size === 0) arrivals.delete(projectId);
        resolve(handlers.get(projectId) ?? null);
      };
      const timer = setTimeout(settle, EDITOR_GRACE_MS);
      waiting.add(settle);
    });
  };

  return {
    register: (projectId, handler) => {
      handlers.set(projectId, handler);
      arrivals.get(projectId)?.forEach((settle) => settle());
      return () => {
        if (handlers.get(projectId) === handler) handlers.delete(projectId);
      };
    },
    has: (projectId) => handlers.has(projectId),
    run: async (command) => {
      const handler = await handlerFor(command.projectId);
      if (!handler) return screenRefusal("no_editor", NO_EDITOR_MESSAGE);
      return runSafely(handler, command);
    },
  };
}

export type ReplyDelivery = "delivered" | "retry" | "gone";

export const REPLY_RETRY_DELAYS_MS = [400, 1000, 2500, 5000] as const;
const REMEMBERED_ANSWERS = 64;

export type ScreenClaim = (threadId: string, commandId: string) => Promise<boolean>;

export interface ScreenAnswererDeps {
  run: (command: ScreenCommand) => Promise<ScreenReply>;
  post: (threadId: string, commandId: string, reply: ScreenReply) => Promise<ReplyDelivery>;
  claim: ScreenClaim;
  wait?: (ms: number) => Promise<void>;
}

export interface ScreenGo {
  id: string;
  claimant: string;
}

export function isScreenGo(value: unknown): value is ScreenGo {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScreenGo>;
  return typeof candidate.id === "string" && candidate.id.length > 0 && typeof candidate.claimant === "string" && candidate.claimant.length > 0;
}

export interface GoSignals {
  expect: (id: string, claimant: string, waitMs: number) => { done: Promise<boolean>; cancel: () => void };
  arrive: (signal: ScreenGo) => void;
}

export function createGoSignals(): GoSignals {
  const waiting = new Map<string, (go: boolean) => void>();
  return {
    expect: (id, claimant, waitMs) => {
      const key = `${id}:${claimant}`;
      let settle: (go: boolean) => void = () => undefined;
      const done = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => settle(false), waitMs);
        settle = (go) => {
          clearTimeout(timer);
          if (waiting.get(key) === settle) waiting.delete(key);
          resolve(go);
        };
        waiting.set(key, settle);
      });
      return { done, cancel: () => settle(false) };
    },
    arrive: (signal) => waiting.get(`${signal.id}:${signal.claimant}`)?.(true),
  };
}

export interface ScreenClaimerDeps {
  post: (threadId: string, commandId: string, claimant: string) => Promise<boolean>;
  signals: GoSignals;
  newClaimant: () => string;
  waitMs: number;
}

export function createScreenClaimer({ post, signals, newClaimant, waitMs }: ScreenClaimerDeps): ScreenClaim {
  return async (threadId, commandId) => {
    const claimant = newClaimant();
    const go = signals.expect(commandId, claimant, waitMs);
    const posted = await post(threadId, commandId, claimant).catch(() => false);
    if (!posted) go.cancel();
    return go.done;
  };
}

export function mayApply(command: ScreenCommand): Promise<boolean> {
  return command.claim ? command.claim() : Promise.resolve(true);
}

export const EXPIRED_MESSAGE = "o pedido expirou antes de o editor aplicar; nada mudou";
export const EXPIRED_REPLY = screenRefusal("expired", EXPIRED_MESSAGE);

interface Answer {
  reply: Promise<ScreenReply>;
  posting: boolean;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createScreenAnswerer({ run, post, claim, wait = pause }: ScreenAnswererDeps) {
  const answers = new Map<string, Answer>();

  const remember = (id: string, answer: Answer) => {
    answers.delete(id);
    answers.set(id, answer);
    if (answers.size > REMEMBERED_ANSWERS) answers.delete(answers.keys().next().value!);
  };

  const deliver = async (threadId: string, commandId: string, reply: ScreenReply) => {
    for (let attempt = 0; ; attempt++) {
      const outcome = await post(threadId, commandId, reply).catch((): ReplyDelivery => "retry");
      if (outcome !== "retry" || attempt >= REPLY_RETRY_DELAYS_MS.length) return;
      await wait(REPLY_RETRY_DELAYS_MS[attempt]);
    }
  };

  return async (threadId: string, command: ScreenCommand): Promise<void> => {
    const known = answers.get(command.id);
    if (known?.posting) return;
    const answer: Answer = { reply: known?.reply ?? run({ ...command, threadId, claim: () => claim(threadId, command.id) }), posting: true };
    remember(command.id, answer);
    try {
      await deliver(threadId, command.id, await answer.reply);
    } finally {
      answer.posting = false;
    }
  };
}
