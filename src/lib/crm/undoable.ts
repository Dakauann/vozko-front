import { toast } from "sonner";

export const UNDO_WINDOW_MS = 6000;

export interface ReversibleAction {
  apply: () => Promise<boolean> | boolean;
  inverse: () => Promise<unknown> | unknown;
  labelKey: string;
}

export type UndoToaster = (
  message: string,
  options: { duration: number; action: { label: string; onClick: () => void } },
) => unknown;

type Translate = (key: string) => string;

const sonnerToaster: UndoToaster = (message, options) => toast(message, options);

export function toastUndo(
  action: Pick<ReversibleAction, "inverse" | "labelKey">,
  t: Translate,
  show: UndoToaster = sonnerToaster,
): void {
  let undone = false;
  show(t(action.labelKey), {
    duration: UNDO_WINDOW_MS,
    action: {
      label: t("undo"),
      onClick: () => {
        if (undone) return;
        undone = true;
        void action.inverse();
      },
    },
  });
}

export async function performReversible(
  action: ReversibleAction,
  t: Translate,
  show: UndoToaster = sonnerToaster,
): Promise<boolean> {
  const accepted = await action.apply();
  if (accepted) toastUndo(action, t, show);
  return accepted;
}
