import { emptyVideoDocument, VIDEO_ASPECT_SIZES, type VideoDocument } from "../document";
import { fixtureJson } from "../library/catalog-file";
import { convertLottie } from "./lottie-convert";
import type { LottieAnimation } from "./lottie-types";

export const LOTTIE_FIXTURE_DIR = "vozko-back/domain/studio/testdata/lottie";

export const LOTTIE_CONVERTED_FIXTURES = ["static-shapes", "keyframes", "trim", "mask", "precomp", "parenting", "morph", "parity"] as const;

export function lottieFixtureDocument(animation: LottieAnimation, name: string): VideoDocument {
  const converted = convertLottie(animation, { canvas: VIDEO_ASPECT_SIZES.square, atMs: 0, name });
  if (!converted.ok) throw new Error(`the Lottie fixture ${name} was refused: ${converted.gaps.map((gap) => `${gap.code} (${gap.where})`).join(", ")}`);
  const doc = emptyVideoDocument("square", "#000000");
  return { ...doc, durationMs: converted.clip.durationMs, tracks: [{ id: "t-lottie", kind: "visual", clips: [converted.clip] }] };
}

export function lottieFixtureJson(animation: LottieAnimation, name: string): string {
  return fixtureJson(lottieFixtureDocument(animation, name));
}
