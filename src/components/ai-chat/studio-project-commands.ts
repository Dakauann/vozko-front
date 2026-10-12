"use client";

import { useMemo } from "react";

import { useAutoOpenScreens } from "@/components/ai-chat/use-auto-open-screens";
import { useAccess } from "@/hooks/use-access";
import { useStudioProjectCreator, type CreateOptions, type StudioProjectOrder, type StudioProjectOutcome } from "@/hooks/use-studio-project-creator";
import { openDock } from "@/lib/aichat/dock-state";
import { browserLocks, EXPIRED_REPLY, mayApply, oncePerTabs, screenOk, screenRefusal, type ScreenHandler, type TabLocks } from "@/lib/aichat/screen";
import type { StudioKind } from "@/lib/studio/document";

import { useProjectCreator } from "./screen-bridge";
import { studioOrderFrom } from "./studio-project-order";

const UNREADABLE_ORDER = "o pedido do projeto não pôde ser lido nesta aba; nada foi criado";
const NO_STUDIO_ACCESS = "o usuário não tem acesso a este editor do Estúdio; nada foi criado";

export interface ProjectCommandDeps {
  allowed: (kind: StudioKind) => boolean;
  automatic: () => boolean;
  create: (order: StudioProjectOrder, key: string, options: CreateOptions) => Promise<StudioProjectOutcome>;
  opened: () => void;
  locks: TabLocks | undefined;
}

export function projectCommandHandler(deps: ProjectCommandDeps): ScreenHandler {
  return async (command) => {
    const order = studioOrderFrom(command.args);
    if (!order) return screenRefusal("invalid_order", UNREADABLE_ORDER);
    if (!deps.allowed(order.kind)) return screenRefusal("no_access", NO_STUDIO_ACCESS);
    return oncePerTabs(
      command.id,
      async () => {
        if (!(await mayApply(command))) return EXPIRED_REPLY;
        const open = deps.automatic();
        const origin = command.threadId ? { threadId: command.threadId, commandId: command.id } : undefined;
        const outcome = await deps.create(order, command.id, origin ? { open, origin } : { open });
        if (!outcome.ok) return screenRefusal("create_failed", outcome.error);
        if (open) deps.opened();
        return screenOk({ projectId: outcome.projectId, kind: order.kind, opened: open });
      },
      deps.locks,
    );
  };
}

export function useStudioProjectCommands() {
  const { decideScreen } = useAccess();
  const { preference } = useAutoOpenScreens();
  const { create } = useStudioProjectCreator();
  const handler = useMemo(
    () =>
      projectCommandHandler({
        allowed: (kind) => decideScreen(kind === "image" ? "studio_image" : "studio_video").status === "allowed",
        automatic: () => preference === "on",
        create,
        opened: openDock,
        locks: browserLocks(),
      }),
    [decideScreen, preference, create],
  );
  useProjectCreator(handler);
}

export function StudioProjectCommandsHost() {
  useStudioProjectCommands();
  return null;
}
