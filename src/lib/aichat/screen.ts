export const SCREEN_COMMANDS = ["read", "edit", "look", "resolve_source", "follow_job"] as const;

export type ScreenCommandName = (typeof SCREEN_COMMANDS)[number];

export interface ScreenCommand {
  id: string;
  name: ScreenCommandName;
  projectId: string;
  args?: unknown;
}

export interface ScreenError {
  code: string;
  message: string;
}

export type ScreenReply = { ok: true; data?: unknown; images?: string[] } | { ok: false; error: ScreenError };

export type ScreenHandler = (command: ScreenCommand) => Promise<ScreenReply>;

export const MAX_SCREEN_MESSAGE = 4000;

export function screenOk(data?: unknown, images?: string[]): ScreenReply {
  return images && images.length > 0 ? { ok: true, data, images } : { ok: true, data };
}

export function screenRefusal(code: string, message: string): ScreenReply {
  const clean = /^[a-z][a-z0-9_]{0,63}$/.test(code) ? code : "refused";
  return { ok: false, error: { code: clean, message: message.slice(0, MAX_SCREEN_MESSAGE) } };
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
export const EDITOR_GRACE_MS = 3000;

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
      try {
        return await handler(command);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return screenRefusal("editor_failed", `o editor falhou ao executar o pedido: ${detail}`);
      }
    },
  };
}

export type ReplyDelivery = "delivered" | "retry" | "gone";

export const REPLY_RETRY_DELAYS_MS = [400, 1000, 2500, 5000] as const;
const REMEMBERED_ANSWERS = 64;

export interface ScreenAnswererDeps {
  run: (command: ScreenCommand) => Promise<ScreenReply>;
  post: (threadId: string, commandId: string, reply: ScreenReply) => Promise<ReplyDelivery>;
  wait?: (ms: number) => Promise<void>;
}

interface Answer {
  reply: Promise<ScreenReply>;
  posting: boolean;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createScreenAnswerer({ run, post, wait = pause }: ScreenAnswererDeps) {
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
    const answer: Answer = { reply: known?.reply ?? run(command), posting: true };
    remember(command.id, answer);
    try {
      await deliver(threadId, command.id, await answer.reply);
    } finally {
      answer.posting = false;
    }
  };
}
