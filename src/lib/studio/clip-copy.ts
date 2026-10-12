import { newStudioId, type Clip, type Track } from "./document";

function renamedId(ids: ReadonlyMap<string, string>, id: string): string {
  return ids.get(id) ?? id;
}

function withFreshParts(clip: Clip, id: string): Clip {
  const copy: Clip = { ...clip, id };
  if (clip.layer) copy.layer = { ...clip.layer, id: newStudioId("l") };
  if (clip.tracks) copy.tracks = freshTracks(clip.tracks);
  return copy;
}

function copiedClip(clip: Clip, ids: ReadonlyMap<string, string>, links: Map<string, string>): Clip {
  const copy = withFreshParts(clip, renamedId(ids, clip.id));
  if (clip.parentId) copy.parentId = renamedId(ids, clip.parentId);
  if (clip.linkId) copy.linkId = links.get(clip.linkId) ?? links.set(clip.linkId, newStudioId("k")).get(clip.linkId)!;
  return copy;
}

export function freshTracks(tracks: readonly Track[]): Track[] {
  const ids = new Map<string, string>();
  for (const track of tracks) {
    ids.set(track.id, newStudioId("t"));
    for (const clip of track.clips) ids.set(clip.id, newStudioId("c"));
  }
  const links = new Map<string, string>();
  return tracks.map((track) => {
    const copy: Track = { ...track, id: renamedId(ids, track.id), clips: track.clips.map((clip) => copiedClip(clip, ids, links)) };
    if (track.transitions) copy.transitions = track.transitions.map((transition) => ({ ...transition, id: newStudioId("tr"), fromClipId: renamedId(ids, transition.fromClipId), toClipId: renamedId(ids, transition.toClipId) }));
    if (track.ducking) copy.ducking = { ...track.ducking, triggerTrackIds: track.ducking.triggerTrackIds.map((id) => renamedId(ids, id)) };
    return copy;
  });
}

export function freshClip(clip: Clip): Clip {
  return withFreshParts(clip, newStudioId("c"));
}
