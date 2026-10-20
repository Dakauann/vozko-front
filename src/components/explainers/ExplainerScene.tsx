import { CompareScene } from "./scenes/CompareScene";
import { FanOutScene } from "./scenes/FanOutScene";
import { FlowScene } from "./scenes/FlowScene";
import { TimelineScene } from "./scenes/TimelineScene";
import { WavesScene } from "./scenes/WavesScene";
import type { SceneNodeSpec, SceneSpec } from "./catalog/types";

export function ExplainerScene({ spec, text, label }: { spec: SceneSpec; text: (key: string) => string; label: string }) {
  const node = <T extends SceneNodeSpec>(n: T): T => ({ ...n, label: text(n.label) });
  switch (spec.kind) {
    case "flow":
      return <FlowScene label={label} nodes={spec.nodes.map(node)} />;
    case "compare":
      return (
        <CompareScene
          label={label}
          off={{ label: text(spec.off.label), rows: spec.off.rows.map((row) => ({ ...row, label: text(row.label) })) }}
          on={{ label: text(spec.on.label), rows: spec.on.rows.map((row) => ({ ...row, label: text(row.label) })) }}
        />
      );
    case "timeline":
      return (
        <TimelineScene
          label={label}
          events={spec.events.map(node)}
          start={spec.start ? text(spec.start) : undefined}
          end={spec.end ? text(spec.end) : undefined}
        />
      );
    case "fanout":
      return (
        <FanOutScene
          label={label}
          source={node(spec.source)}
          targets={spec.targets.map((target) => ({ ...node(target), note: target.note ? text(target.note) : undefined }))}
          picked={spec.picked}
        />
      );
    case "waves":
      return <WavesScene label={label} labels={{ grow: text("grow"), slow: text("slow"), hold: text("hold") }} />;
  }
}
