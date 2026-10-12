import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newOverlayClip, newShapeLayer, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { addTransition } from "@/lib/studio/transitions";

import { Inspector } from "../inspector/inspector";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const pt = ptMessages.studio.video;

function keyHere(name: string): string {
  return pt.keyframes.keyHere.replace("{name}", name);
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    {
      id: "v1",
      kind: "visual",
      clips: [
        { ...newOverlayClip({ ...newTextLayer("Oferta"), fill: "#ffffff" }, 0, 4000), id: "t" },
        { ...newOverlayClip({ ...newShapeLayer("rect"), fill: "#ff0000", gradient: { from: "#ff0000", to: "#0000ff", angle: 90 }, stroke: "#000000", strokeWidth: 4 }, 4000, 2000), id: "g" },
      ],
    },
  ];
  d.durationMs = 6000;
  return d;
}

function clipOf(editor: ReturnType<typeof renderInEditor>["editor"], id: string) {
  return findClip(editor.store.getState().document, id)!.clip;
}

function typeColor(label: string, value: string) {
  const input = screen.getByRole("textbox", { name: label });
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("color animation by hand", () => {
  it("starts a fill animation from the diamond beside the color, keys a second color later and eases it", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["t"]);
      editor.view.setState({ playheadMs: 500 });
    });
    const diamond = screen.getByRole("button", { name: keyHere(pt.layer.fill) });
    expect(diamond.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(diamond);
    expect(clipOf(editor, "t").keyframes?.fill).toEqual([{ atMs: 500, color: "#ffffff", easing: "linear" }]);
    expect(screen.getByRole("button", { name: keyHere(pt.layer.fill) }).getAttribute("aria-pressed")).toBe("true");

    act(() => editor.view.setState({ playheadMs: 3000 }));
    typeColor(pt.layer.fill, "#ff0000");
    expect(clipOf(editor, "t").keyframes?.fill?.map((frame) => [frame.atMs, frame.color])).toEqual([
      [500, "#ffffff"],
      [3000, "#ff0000"],
    ]);
    expect(clipOf(editor, "t").layer?.fill).toBe("#ffffff");

    act(() => editor.view.setState({ playheadMs: 500 }));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.animation }));
    fireEvent.click(within(screen.getByRole("group", { name: pt.keyframes.easingMoment })).getByRole("button", { name: pt.keyframes.easings.easeOut }));
    expect(clipOf(editor, "t").keyframes?.fill?.[0].easing).toBe("easeOut");
  });

  it("removes the key under the playhead with the same diamond", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["t"]);
      editor.view.setState({ playheadMs: 1000 });
    });
    fireEvent.click(screen.getByRole("button", { name: keyHere(pt.layer.fill) }));
    fireEvent.click(screen.getByRole("button", { name: keyHere(pt.layer.fill) }));
    expect(clipOf(editor, "t").keyframes?.fill).toBeUndefined();
  });

  it("animates the outline color of a gradient shape, whose fill is a gradient", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["g"]);
      editor.view.setState({ playheadMs: 4500 });
    });
    expect(screen.queryByRole("button", { name: keyHere(pt.layer.fill) })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: keyHere(pt.layer.outline) }));
    act(() => editor.view.setState({ playheadMs: 5500 }));
    typeColor(pt.layer.outline, "#00ff00");
    expect(clipOf(editor, "g").keyframes?.stroke?.map((frame) => frame.color)).toEqual(["#000000", "#00ff00"]);
  });

  it("animates blur from the diamond beside the blur field", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["t"]);
      editor.view.setState({ playheadMs: 0 });
    });
    fireEvent.click(screen.getByRole("button", { name: keyHere(pt.inspector.blur) }));
    expect(clipOf(editor, "t").keyframes?.blur).toEqual([{ atMs: 0, value: 0, easing: "linear" }]);
  });

  it("explains that the playhead must be inside the clip", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["t"]);
      editor.view.setState({ playheadMs: 5000 });
    });
    fireEvent.click(screen.getByRole("button", { name: keyHere(pt.layer.fill) }));
    expect(clipOf(editor, "t").keyframes).toBeUndefined();
    expect(screen.getByRole("alert").textContent).toContain(pt.inspector.notices.keyframeOutside);
  });
});

describe("color lanes on the timeline", () => {
  it("keys a color lane from its header and draws the blend between the keys", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.commands.enterFocus("t"));
    act(() => editor.view.setState({ playheadMs: 1000 }));
    const header = screen.getByRole("group", { name: pt.keyframes.laneHeaders });
    fireEvent.click(within(header).getByRole("button", { name: keyHere(pt.keyframes.properties.fill) }));
    expect(clipOf(editor, "t").keyframes?.fill?.map((frame) => frame.atMs)).toEqual([1000]);

    act(() => editor.view.setState({ playheadMs: 3000 }));
    fireEvent.click(within(header).getByRole("button", { name: keyHere(pt.keyframes.properties.fill) }));
    expect(clipOf(editor, "t").keyframes?.fill?.map((frame) => frame.atMs)).toEqual([1000, 3000]);
    expect(screen.getAllByLabelText(new RegExp(`${pt.keyframes.properties.fill} em`))).toHaveLength(2);
  });
});

describe("color between clips and behind them", () => {
  it("dips through a picked color between two clips", { timeout: 15_000 }, () => {
    const d = doc();
    const added = addTransition(d, { fromClipId: "t", toClipId: "g", kind: "dipToColor" });
    if (!added.ok) throw new Error("refused");
    const { editor } = renderInEditor(added.document, <Inspector />);
    act(() => editor.view.setState({ selectedTransitionId: added.transitionId }));
    typeColor(pt.transitions.options.color, "#ffcc00");
    expect(editor.store.getState().document.tracks[0].transitions?.[0]).toMatchObject({ kind: "dipToColor", color: "#ffcc00" });
  });

  it("changes the project background color with nothing selected", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    typeColor(pt.inspector.background, "#102030");
    expect(editor.store.getState().document.canvas.background).toBe("#102030");
  });
});
