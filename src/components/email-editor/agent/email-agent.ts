import { replaySteps, stepDelay, type ReplayPresence, type ReplayStore, type ReplayTarget } from "@/components/coworker/replay";
import { EXPIRED_REPLY, mayApply, screenOk, screenRefusal, type ScreenCommand, type ScreenHandler, type ScreenReply } from "@/lib/aichat/screen";
import { lookRequestOf, markLegend, type LookRequest, type MarkLegend } from "@/lib/email-design/agent/look";
import { editPayloadOf, stepDocuments, type EmailStep } from "@/lib/email-design/agent/steps";
import type { Document } from "@/lib/email-design/types";

import type { LookCapture } from "./capture";

const NOT_EMAIL = "este pedido não existe no editor de e-mail";
const READ_ONLY = "o usuário só pode ver este design, sem editar; nada foi aplicado";
const INVALID_EDIT = "o lote chegou ilegível ao editor; nada foi aplicado";
const INVALID_LOOK = "o pedido de captura chegou ilegível ao editor";
const CAPTURE_FAILED = "o navegador não conseguiu desenhar a prévia";

export interface LiveDesign {
  document: Document;
  selected: string | null;
  name: string;
  readOnly: boolean;
}

export interface EmailAgentDeps {
  live: () => LiveDesign;
  store: ReplayStore<Document>;
  presence: ReplayPresence;
  locate: (focus: string | null) => ReplayTarget | null;
  label: (op: string) => string;
  reduceMotion: () => boolean;
  hidden: () => boolean;
  capture: (request: LookRequest, legend: readonly MarkLegend[]) => Promise<LookCapture>;
}

function read(deps: EmailAgentDeps): ScreenReply {
  const live = deps.live();
  return screenOk({ document: live.document, ...(live.selected ? { selected: live.selected } : {}), name: live.name });
}

async function edit(deps: EmailAgentDeps, command: ScreenCommand): Promise<ScreenReply> {
  if (deps.live().readOnly) return screenRefusal("read_only", READ_ONLY);
  const payload = editPayloadOf(command.args);
  if (!payload) return screenRefusal("invalid_edit", INVALID_EDIT);
  if (!(await mayApply(command))) return EXPIRED_REPLY;
  const steps = stepDocuments(payload);
  const outcome = await replaySteps<Document, EmailStep>(payload.base, steps, {
    store: deps.store,
    presence: deps.presence,
    locate: (focus) => deps.locate(focus as string | null),
    label: (step) => deps.label(step.op),
    delayMs: stepDelay(steps.length, deps.reduceMotion()),
    hidden: deps.hidden,
  });
  return screenOk({ document: deps.store.getState().document, conflicts: outcome.conflicts, skipped: outcome.skipped });
}

async function look(deps: EmailAgentDeps, command: ScreenCommand): Promise<ScreenReply> {
  const request = lookRequestOf(command.args);
  if (!request) return screenRefusal("invalid_look", INVALID_LOOK);
  try {
    const capture = await deps.capture(request, markLegend(deps.live().document));
    return screenOk(capture.data, [capture.image]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return screenRefusal("capture_failed", `${CAPTURE_FAILED}: ${detail}`);
  }
}

export function createEmailAgent(deps: EmailAgentDeps): ScreenHandler {
  return async (command) => {
    switch (command.name) {
      case "read":
        return read(deps);
      case "edit":
        return edit(deps, command);
      case "look":
        return look(deps, command);
    }
    return screenRefusal("not_email", NOT_EMAIL);
  };
}
