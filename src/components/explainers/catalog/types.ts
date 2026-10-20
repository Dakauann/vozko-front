import type { Icon } from "@/components/icons";

import type { SceneTone } from "../scenes/scene-kit";

export type SceneNodeSpec = { icon: Icon; label: string; tone?: SceneTone };

export type SceneSpec =
  | { kind: "flow"; nodes: SceneNodeSpec[] }
  | { kind: "compare"; off: { label: string; rows: { icon?: Icon; label: string }[] }; on: { label: string; rows: { icon?: Icon; label: string }[] } }
  | { kind: "timeline"; events: (SceneNodeSpec & { at: number })[]; start?: string; end?: string }
  | { kind: "fanout"; source: SceneNodeSpec; targets: (SceneNodeSpec & { note?: string })[]; picked?: number }
  | { kind: "waves" };

export type ExplainerSpec = {
  icon: Icon;
  scene: SceneSpec;
  steps: 2 | 3 | 4;
  footnote?: boolean;
};

export type ExplainerArea = Record<string, ExplainerSpec>;
