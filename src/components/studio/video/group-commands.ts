import type { VideoDocument } from "@/lib/studio/document";
import { groupClips, ungroupClip } from "@/lib/studio/group-edits";
import { directGroup, groupChain, innerMsAt, outerMsAt } from "@/lib/studio/group-scope";
import type { StudioEditorStore } from "@/lib/studio/store";

import type { NoticeTone, VideoViewState, VideoViewStore } from "./view-store";

export interface GroupCommands {
  groupSelection: (name?: string) => boolean;
  ungroupSelection: () => boolean;
  openGroup: (groupId: string) => boolean;
  openSelection: () => boolean;
  closeGroup: (levels?: number) => void;
}

interface GroupCommandDeps {
  store: StudioEditorStore<VideoDocument>;
  root: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  notify: (key: string, tone?: NoticeTone) => void;
  seek: (ms: number) => void;
  pause: () => void;
}

function leftBehind(): Partial<VideoViewState> {
  return { range: { inMs: null, outMs: null }, focus: null, selectedKeys: [], selectedTransitionId: null, selectedGap: null, graphEditor: false };
}

export function createGroupCommands({ store, root, view, notify, seek, pause }: GroupCommandDeps): GroupCommands {
  const state = () => store.getState();

  const openGroup = (groupId: string): boolean => {
    const group = directGroup(state().document, groupId);
    if (!group) return false;
    pause();
    const { groupPath, playheadMs } = view.getState();
    const inner = Math.max(0, Math.round(innerMsAt(group, Math.min(Math.max(playheadMs, group.startMs), group.startMs + group.durationMs))));
    view.setState({ groupPath: [...groupPath, groupId], ...leftBehind() });
    state().select([]);
    seek(inner);
    return true;
  };

  return {
    groupSelection: (name) => {
      const result = groupClips(state().document, state().selection, name);
      if (!result.ok) {
        notify(`groups.${result.reason}`, result.reason === "empty" ? "info" : "error");
        return false;
      }
      state().apply(() => result.document, [result.groupId]);
      return true;
    },
    ungroupSelection: () => {
      const groups = state().selection.filter((id) => directGroup(state().document, id));
      if (groups.length !== 1) {
        notify(groups.length === 0 ? "groups.noGroup" : "groups.oneAtATime");
        return false;
      }
      const result = ungroupClip(state().document, groups[0]);
      if (!result.ok) {
        notify(result.reason === "keeps" ? `groups.keeps.${result.properties[0]}` : `groups.${result.reason}`, "error");
        return false;
      }
      state().apply(() => result.document, result.clipIds);
      return true;
    },
    openGroup,
    openSelection: () => {
      const groups = state().selection.filter((id) => directGroup(state().document, id));
      if (groups.length !== 1) {
        notify(groups.length === 0 ? "groups.noGroup" : "groups.oneAtATime");
        return false;
      }
      return openGroup(groups[0]);
    },
    closeGroup: (levels = 1) => {
      const { groupPath, playheadMs } = view.getState();
      if (groupPath.length === 0) return;
      const keep = Math.max(0, groupPath.length - levels);
      const chain = groupChain(root.getState().document, groupPath);
      const outer = chain.slice(keep).reduceRight((ms, group) => outerMsAt(group, ms), playheadMs);
      pause();
      view.setState({ groupPath: groupPath.slice(0, keep), ...leftBehind() });
      state().select(chain[keep] ? [chain[keep].id] : []);
      seek(Math.max(0, Math.round(outer)));
    },
  };
}
