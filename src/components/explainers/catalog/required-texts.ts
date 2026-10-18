import { explainerSpec, type ExplainerId } from "./index";
import type { SceneSpec } from "./types";

function sceneKeys(scene: SceneSpec): string[] {
  switch (scene.kind) {
    case "flow":
      return scene.nodes.map((node) => node.label);
    case "compare":
      return [scene.off.label, scene.on.label, ...scene.off.rows.map((row) => row.label), ...scene.on.rows.map((row) => row.label)];
    case "timeline":
      return [...scene.events.map((event) => event.label), ...[scene.start, scene.end].filter((key): key is string => Boolean(key))];
    case "fanout":
      return [scene.source.label, ...scene.targets.map((target) => target.label)];
    case "waves":
      return ["grow", "slow", "hold"];
  }
}

export function requiredTexts(id: ExplainerId): string[] {
  const spec = explainerSpec(id);
  const steps = Array.from({ length: spec.steps }, (_, index) => [`steps.${index + 1}.title`, `steps.${index + 1}.text`]).flat();
  return ["name", "tagline", ...steps, ...(spec.footnote ? ["footnote"] : []), ...sceneKeys(spec.scene).map((key) => `scene.${key}`)];
}
