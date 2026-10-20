import { describe, expect, it, vi } from "vitest";

import { UNDO_WINDOW_MS, performReversible, toastUndo, type UndoToaster } from "../undoable";

const t = (key: string) => `t:${key}`;

function fakeToaster() {
  const calls: Parameters<UndoToaster>[] = [];
  const show: UndoToaster = (message, options) => {
    calls.push([message, options]);
  };
  return { show, calls };
}

describe("undo toast", () => {
  it("names what happened and offers Desfazer for six seconds", () => {
    const { show, calls } = fakeToaster();

    toastUndo({ inverse: vi.fn(), labelKey: "stageMoved" }, t, show);

    expect(calls).toHaveLength(1);
    const [message, options] = calls[0];
    expect(message).toBe("t:stageMoved");
    expect(options.duration).toBe(UNDO_WINDOW_MS);
    expect(UNDO_WINDOW_MS).toBe(6000);
    expect(options.action.label).toBe("t:undo");
  });

  it("runs the inverse as a new command when Desfazer is pressed, and only once", () => {
    const { show, calls } = fakeToaster();
    const inverse = vi.fn();

    toastUndo({ inverse, labelKey: "stageMoved" }, t, show);
    calls[0][1].action.onClick();
    calls[0][1].action.onClick();

    expect(inverse).toHaveBeenCalledTimes(1);
  });

  it("never runs the inverse on its own when the toast just expires", () => {
    const { show } = fakeToaster();
    const inverse = vi.fn();

    toastUndo({ inverse, labelKey: "stageMoved" }, t, show);

    expect(inverse).not.toHaveBeenCalled();
  });
});

describe("reversible actions", () => {
  it("offers undo once the server accepted the action", async () => {
    const { show, calls } = fakeToaster();

    await performReversible({ apply: async () => true, inverse: vi.fn(), labelKey: "assigned" }, t, show);

    expect(calls).toHaveLength(1);
  });

  it("offers nothing to undo when the server refused", async () => {
    const { show, calls } = fakeToaster();

    await performReversible({ apply: async () => false, inverse: vi.fn(), labelKey: "assigned" }, t, show);

    expect(calls).toHaveLength(0);
  });
});
