import { Fragment } from "react";

import type { Icon } from "@/components/icons";

import { SceneConnector, SceneFrame, SceneTile, type SceneTone } from "./scene-kit";

export type FlowNode = { icon: Icon; label: string; tone?: SceneTone };

export function FlowScene({ nodes, label }: { nodes: FlowNode[]; label: string }) {
  return (
    <SceneFrame label={label}>
      <div className="flex items-start justify-center gap-1.5">
        {nodes.map((node, index) => (
          <Fragment key={index}>
            {index > 0 ? <SceneConnector index={index * 2 - 1} className="mt-[1.375rem]" /> : null}
            <SceneTile icon={node.icon} label={node.label} tone={node.tone} index={index * 2} />
          </Fragment>
        ))}
      </div>
    </SceneFrame>
  );
}
