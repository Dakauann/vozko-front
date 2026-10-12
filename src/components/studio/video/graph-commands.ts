import type { VideoDocument } from "@/lib/studio/document";
import type { GraphMode, GraphShow, GraphTarget } from "@/lib/studio/graph-editor";
import type { StudioEditorStore } from "@/lib/studio/store";
import { findClip } from "@/lib/studio/timeline";
import { focusView } from "@/lib/studio/timeline-view";

import type { NoticeTone, VideoViewStore } from "./view-store";

export interface GraphCommands {
  toggleGraph: () => void;
  setGraphMode: (mode: GraphMode) => void;
  setGraphShow: (show: GraphShow) => void;
  setGraphTarget: (target: GraphTarget) => void;
  fitGraph: (selection: boolean) => void;
}

interface GraphCommandDeps {
  store: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  notify: (key: string, tone?: NoticeTone) => void;
  enterFocus: () => void;
}

export function createGraphCommands({ store, view, notify, enterFocus }: GraphCommandDeps): GraphCommands {
  return {
    toggleGraph: () => {
      if (view.getState().focus) {
        view.setState((current) => ({ graphEditor: !current.graphEditor }));
        return;
      }
      enterFocus();
      if (view.getState().focus) view.setState({ graphEditor: true });
      else notify("graph.pickClip");
    },
    setGraphMode: (graphMode) => view.setState({ graphMode }),
    setGraphShow: (graphShow) => view.setState({ graphShow }),
    setGraphTarget: (graphTarget) => view.setState({ graphTarget }),
    fitGraph: (selection) => {
      const { focus, selectedKeys, viewportPx } = view.getState();
      const clip = focus ? findClip(store.getState().document, focus.clipId)?.clip : undefined;
      if (!clip) {
        notify("graph.pickClip");
        return;
      }
      const times = selection ? selectedKeys.map((key) => key.atMs) : [];
      const fromMs = times.length > 0 ? Math.min(...times) : 0;
      const spanMs = times.length > 0 ? Math.max(...times) - fromMs : clip.durationMs;
      const { pxPerSecond, scrollLeft } = focusView(clip.startMs + fromMs, spanMs, viewportPx);
      view.setState({ graphFit: times.length > 0 ? "selection" : "all", pxPerSecond, scrollRequest: scrollLeft });
    },
  };
}
