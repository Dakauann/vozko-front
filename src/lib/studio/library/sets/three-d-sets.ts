import type { LibrarySource } from "../model";
import type { Names } from "./format";

export const THREE_D_PUBLIC_DIR = "images/studio/library-3d";

interface ThreeDSet {
  id: string;
  subcategory: "icons" | "emoji";
  source: LibrarySource;
}

export const THREE_D_SETS: readonly ThreeDSet[] = [
  { id: "3dicons", subcategory: "icons", source: { set: "3dicons", license: "CC0-1.0", credit: "Vijay Verma", url: "https://3dicons.co/" } },
  { id: "fluent-emoji-3d", subcategory: "emoji", source: { set: "fluent-emoji-3d", license: "MIT", credit: "Microsoft Corporation", url: "https://github.com/microsoft/fluentui-emoji" } },
];

export interface ThreeDEntry {
  id: string;
  g: number;
  l: Names;
  t: readonly string[];
  p: readonly string[];
  file: string;
  sha256: string;
  w: number;
  h: number;
}
