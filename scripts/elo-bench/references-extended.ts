import { openSpecOf, type Brief, type Reference } from "./model";
import type { CorpusEntry } from "./extended/corpus";
import { dataUiCorpus } from "./extended/data-ui";
import { commerceCorpus } from "./extended/commerce";
import { motionCorpus } from "./extended/motion";
import { printCorpus } from "./extended/print";
import { socialCorpus } from "./extended/social";
import { stylesCorpus } from "./extended/styles";
import { missingPhotos } from "./photos";

function corpus(): CorpusEntry[] {
  return [...socialCorpus(), ...dataUiCorpus(), ...stylesCorpus(), ...printCorpus(), ...commerceCorpus(), ...motionCorpus()];
}

export function available(entries: readonly CorpusEntry[]): CorpusEntry[] {
  const missing = new Set(missingPhotos().map((photo) => photo.slot));
  return entries.filter((entry) => entry.photos.every((slot) => !missing.has(slot)));
}

function originOf(entry: CorpusEntry): string {
  const sources = entry.sources.map((s) => s.url).join(", ");
  const photos = entry.photos.length > 0 ? `; photos ${entry.photos.join(", ")} (origins in photos.ts)` : "; no photo";
  return `rebuilt for this benchmark in the studio document format from the layout of ${sources}, with our own text${photos}`;
}

export function referenceOf(entry: CorpusEntry): Reference {
  const made = entry.make();
  return "tracks" in made ? { id: entry.id, title: entry.title, kind: "video", origin: originOf(entry), doc: made } : { id: entry.id, title: entry.title, kind: "image", origin: originOf(entry), artboard: made };
}

export function extendedCorpus(): CorpusEntry[] {
  return corpus();
}

export function extendedReferences(): Reference[] {
  return available(corpus()).map(referenceOf);
}

export function extendedBriefs(): Brief[] {
  return corpus().map((entry) => ({ id: entry.id, title: entry.title, open: openSpecOf(referenceOf(entry)), text: entry.brief }));
}
