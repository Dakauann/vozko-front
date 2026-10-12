import type { CorpusEntry } from "./extended/corpus";
import type { Brief, Reference } from "./model";
import { openSpecOf } from "./model";
import { available, referenceOf } from "./references-extended";
import { campaignsCorpus } from "./sota/campaigns";
import { postersCorpus } from "./sota/posters";
import { screensCorpus } from "./sota/screens";
import { socialCorpus } from "./sota/social";

function corpus(): CorpusEntry[] {
  return [...campaignsCorpus(), ...postersCorpus(), ...socialCorpus(), ...screensCorpus()];
}

export function sotaCorpus(): CorpusEntry[] {
  return corpus();
}

export const SOTA_IDS: ReadonlySet<string> = new Set(corpus().map((entry) => entry.id));

export function sotaReferences(): Reference[] {
  return available(corpus()).map(referenceOf);
}

export function sotaBriefs(): Brief[] {
  return corpus().map((entry) => ({ id: entry.id, title: entry.title, open: openSpecOf(referenceOf(entry)), text: entry.brief }));
}
