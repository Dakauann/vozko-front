"use client";

import { useMemo } from "react";

import { useAutoOpenScreens } from "@/components/ai-chat/use-auto-open-screens";
import { useAccess } from "@/hooks/use-access";
import { useRouter } from "@/i18n/routing";
import { openDock } from "@/lib/aichat/dock-state";
import { browserLocks, EXPIRED_REPLY, mayApply, oncePerTabs, screenOk, screenRefusal, type ScreenHandler, type TabLocks } from "@/lib/aichat/screen";
import { pathForScreen } from "@/lib/navigation/routes";

import { useAppScreenCommand } from "./screen-bridge";

const UNREADABLE_ORDER = "o pedido para abrir o design não pôde ser lido nesta aba; nada foi aberto";
const NO_EDITOR_ACCESS = "o usuário não tem acesso ao editor de e-mail; nada foi aberto";
const DESIGN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface DesignOpenerDeps {
  allowed: () => boolean;
  automatic: () => boolean;
  open: (path: string) => void;
  opened: () => void;
  locks: TabLocks | undefined;
}

function designIdOf(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const id = (args as { designId?: unknown }).designId;
  return typeof id === "string" && DESIGN_ID.test(id) ? id : null;
}

export function designOpenerHandler(deps: DesignOpenerDeps): ScreenHandler {
  return async (command) => {
    const designId = designIdOf(command.args);
    const path = designId ? pathForScreen("email_design", { designId }) : null;
    if (!designId || !path) return screenRefusal("invalid_order", UNREADABLE_ORDER);
    if (!deps.allowed()) return screenRefusal("no_access", NO_EDITOR_ACCESS);
    return oncePerTabs(
      command.id,
      async () => {
        if (!(await mayApply(command))) return EXPIRED_REPLY;
        const open = deps.automatic();
        if (open) {
          deps.open(path);
          deps.opened();
        }
        return screenOk({ projectId: designId, kind: "email", opened: open });
      },
      deps.locks,
    );
  };
}

function useEmailDesignCommands() {
  const { decideScreen } = useAccess();
  const { preference } = useAutoOpenScreens();
  const router = useRouter();
  const handler = useMemo(
    () =>
      designOpenerHandler({
        allowed: () => decideScreen("email_design").status === "allowed",
        automatic: () => preference === "on",
        open: (path) => router.push(path),
        opened: openDock,
        locks: browserLocks(),
      }),
    [decideScreen, preference, router],
  );
  useAppScreenCommand("open_design", handler);
}

export function EmailDesignCommandsHost() {
  useEmailDesignCommands();
  return null;
}
