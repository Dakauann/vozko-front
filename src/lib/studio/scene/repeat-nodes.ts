import { repeatCopies, type ClipRepeat } from "../clip-repeat";
import { placeBy, type Affine, type RepeatBox } from "../repeat";
import { repeatCopyId } from "../repeat-edits";
import type { SceneBox, SceneNode } from "./scene";

function boundsOf(box: SceneBox): RepeatBox {
  const angle = (box.rotation * Math.PI) / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * box.width + Math.abs(Math.sin(angle)) * box.height) / 2;
  const halfHeight = (Math.abs(Math.sin(angle)) * box.width + Math.abs(Math.cos(angle)) * box.height) / 2;
  return { left: box.x - halfWidth, top: box.y - halfHeight, right: box.x + halfWidth, bottom: box.y + halfHeight };
}

export function movedBox(box: SceneBox, place: Affine, flipX: boolean): { box: SceneBox; flipX: boolean } {
  const pose = placeBy(place, { x: box.x, y: box.y, rotation: box.rotation, flipX });
  return { box: { x: pose.x, y: pose.y, width: box.width * pose.scale, height: box.height * pose.scale, rotation: pose.rotation }, flipX: pose.flipX };
}

function copied(node: SceneNode, place: Affine, opacity: number, id: string): SceneNode {
  const moved = movedBox(node.box, place, Boolean(node.flipX));
  const copy: SceneNode = { ...node, id, box: moved.box, opacity: node.opacity * opacity };
  if (moved.flipX) copy.flipX = true;
  else delete copy.flipX;
  if (node.reveal && node.reveal.box === node.box) copy.reveal = { ...node.reveal, box: moved.box };
  if (node.trail) copy.trail = { ...node.trail, box: movedBox(node.trail.box, place, false).box };
  if (node.vfxFrame) copy.vfxFrame = movedBox(node.vfxFrame, place, false).box;
  return copy;
}

export function repeatedNodes(node: SceneNode, repeat: ClipRepeat, content: SceneBox): SceneNode[] {
  return repeatCopies(repeat, boundsOf(content)).map((copy) => copied(node, copy.place, copy.opacity, copy.index === 0 ? node.id : repeatCopyId(node.id, copy.index)));
}
