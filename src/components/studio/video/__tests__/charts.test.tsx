import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { chartInk, newChartSpec } from "@/lib/studio/chart";
import { emptyVideoDocument, newOverlayClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { documentIssue } from "@/lib/studio/validate";

import { Inspector } from "../inspector/inspector";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  const spec = newChartSpec("lineMulti", { labels: ["T1", "T2", "T3"], series: [{ name: "A", values: [1, 3, 2] }, { name: "B", values: [2, 2, 4] }] }, "pt-BR", chartInk("#ffffff"));
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newOverlayClip({ id: "g", type: "chart", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }, chart: spec }, 0, 4000), id: "c" }] }];
  d.durationMs = 4000;
  return d;
}

type Editor = ReturnType<typeof renderInEditor>["editor"];

const chartClip = (editor: Editor) => findClip(editor.store.getState().document, "c")!.clip;

describe("charts in the video inspector", () => {
  it("restyles a chart clip by hand", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["c"]));
    const t = ptMessages.studio.chart;
    fireEvent.change(screen.getByLabelText(t.kind), { target: { value: "area" } });
    expect(chartClip(editor).layer?.chart?.kind).toBe("area");
    fireEvent.click(screen.getByRole("button", { name: t.editData }));
    expect(editor.view.getState().dataEditorFor).toBe("c");
    expect(screen.getByRole("dialog", { name: t.data.title })).toBeTruthy();
  });

  it("gives the chart an entrance with order, timing and curve", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["c"]));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.animation }));
    const t = ptMessages.studio.chart.motion;
    fireEvent.change(screen.getByLabelText(t.style), { target: { value: "draw" } });
    expect(chartClip(editor).chartIn).toMatchObject({ style: "draw", order: "series" });
    fireEvent.change(screen.getByLabelText(t.order), { target: { value: "category" } });
    const stagger = screen.getByLabelText(t.stagger);
    fireEvent.change(stagger, { target: { value: "0,3" } });
    fireEvent.blur(stagger);
    expect(chartClip(editor).chartIn).toMatchObject({ order: "category", staggerMs: 300 });
    expect(documentIssue("video", editor.store.getState().document)).toBeNull();
    fireEvent.change(screen.getByLabelText(t.style), { target: { value: "none" } });
    expect(chartClip(editor).chartIn).toBeUndefined();
  });
});
