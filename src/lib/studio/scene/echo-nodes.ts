import type { Scene, SceneNode } from "./scene";

const ECHO_MARK = "~echo";

function suffixedScene(scene: Scene, suffix: string): Scene {
  return { ...scene, nodes: scene.nodes.map((node) => suffixed(node, suffix)) };
}

function suffixed(node: SceneNode, suffix: string): SceneNode {
  const id = `${node.id}${suffix}`;
  const clipOf = node.clipOf ? { clipOf: `${node.clipOf}${suffix}` } : {};
  if (node.source.kind === "video") return { ...node, ...clipOf, id, source: { ...node.source, clipId: `${node.source.clipId}${suffix}` } };
  if (node.source.kind === "group") return { ...node, ...clipOf, id, source: { kind: "group", scene: suffixedScene(node.source.scene, suffix) } };
  return { ...node, ...clipOf, id };
}

export function echoNode(copy: SceneNode, main: SceneNode, index: number): SceneNode {
  const matte = main.clipOf ? { clipOf: main.clipOf, ...(main.clipMatte ? { clipMatte: main.clipMatte } : {}) } : {};
  return { ...suffixed(copy, `${ECHO_MARK}${index}`), ...matte };
}
