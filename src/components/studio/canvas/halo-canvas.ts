"use client";

import { effectHalo } from "@/lib/studio/effect-pixels";
import { fitRect } from "@/lib/studio/fit";
import { haloLayout, maskedAlpha, pictureRect, rectAlpha, type HaloLayout, type HaloNode, type SourceSize } from "@/lib/studio/media-halo";

import { loadAssetImage } from "./asset-images";

function pictureAlpha(image: HTMLImageElement, halo: HaloNode, layout: HaloLayout): Float32Array {
  const picture = halo.picture;
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const placed = fitRect(image.naturalWidth, image.naturalHeight, layout.boxWidth, layout.boxHeight, picture.fit);
  const flipX = picture.kind === "image" && picture.flipX;
  const flipY = picture.kind === "image" && picture.flipY;
  ctx.translate(layout.pad + layout.boxWidth / 2, layout.pad + layout.boxHeight / 2);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(image, placed.sx, placed.sy, placed.sw, placed.sh, placed.dx - layout.boxWidth / 2, placed.dy - layout.boxHeight / 2, placed.dw, placed.dh);
  const data = ctx.getImageData(0, 0, layout.width, layout.height).data;
  const alpha = new Float32Array(layout.width * layout.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] / 255;
  return alpha;
}

async function silhouette(halo: HaloNode, source: SourceSize | null, layout: HaloLayout): Promise<Float32Array> {
  if (halo.picture.kind === "image") return pictureAlpha(await loadAssetImage(halo.picture.assetId), halo, layout);
  return rectAlpha(layout, pictureRect(halo.picture.fit, source, layout));
}

export async function haloCanvas(halo: HaloNode, source: SourceSize | null, ratio: number): Promise<HTMLCanvasElement> {
  const layout = haloLayout(halo, ratio);
  const alpha = maskedAlpha(await silhouette(halo, source, layout), layout, halo.masks);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  canvas.getContext("2d")!.putImageData(new ImageData(effectHalo(alpha, layout.width, layout.height, halo.plan, layout.scale), layout.width, layout.height), 0, 0);
  return canvas;
}
