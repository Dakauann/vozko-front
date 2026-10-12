import { BUILTIN_SOUNDS, soundAssetId, type BuiltinSound } from "../../builtin-sounds";
import { sizedMediaClips } from "../../media-clips";
import { LIBRARY_ID_PATTERN, localizedText, OWN_SOURCE, type LibraryAssets, type LibraryCategory, type LibraryItem, type LibraryLabel, type LibraryLocale, type LibrarySource, type LocalizedText } from "../model";

export const AUDIO_CATEGORY_ID = "audio";

const SOUND_RATIO = 4;

const USER_SOURCE: LibrarySource = { set: "workspace", license: "own" };

type Tags = Partial<Record<LibraryLocale, readonly string[]>>;

interface SoundSpec {
  id: string;
  assetId: string;
  subcategory: string;
  label: LibraryLabel;
  tags?: Tags;
  source: LibrarySource;
  durationMs: () => number | undefined;
  assets?: LibraryAssets;
}

function soundItem(spec: SoundSpec): LibraryItem {
  return {
    id: spec.id,
    category: AUDIO_CATEGORY_ID,
    subcategory: spec.subcategory,
    editors: ["video"],
    ratio: SOUND_RATIO,
    label: spec.label,
    ...(spec.tags ? { tags: spec.tags } : {}),
    preview: { kind: "sound", assetId: spec.assetId },
    source: spec.source,
    template: { kind: "clips", build: (ctx) => sizedMediaClips("audio", spec.assetId, ctx.atMs, spec.durationMs()) },
    ...(spec.assets ? { assets: spec.assets } : {}),
  };
}

const NAMES: Readonly<Record<string, { name: LocalizedText; tags: Tags }>> = {
  message: { name: localizedText("Notificação", "Notification", "Notificación", "Benachrichtigung"), tags: { pt: ["mensagem", "alerta", "aviso"], en: ["message", "alert", "chime"], es: ["mensaje", "alerta"], de: ["Nachricht", "Hinweis"] } },
  "call-connected": { name: localizedText("Chamada conectada", "Call connected", "Llamada conectada", "Anruf verbunden"), tags: { pt: ["telefone", "atendeu"], en: ["phone", "answer"], es: ["teléfono"], de: ["Telefon"] } },
  "call-ended": { name: localizedText("Chamada encerrada", "Call ended", "Llamada finalizada", "Anruf beendet"), tags: { pt: ["telefone", "desligou"], en: ["phone", "hang up"], es: ["teléfono", "colgar"], de: ["Telefon", "aufgelegt"] } },
  "incoming-call": { name: localizedText("Toque de chamada", "Ringtone", "Tono de llamada", "Klingelton"), tags: { pt: ["telefone", "toque", "ligação"], en: ["phone", "ring", "call"], es: ["teléfono", "timbre"], de: ["Telefon", "Klingeln"] } },
  pop: { name: localizedText("Pop", "Pop", "Pop", "Plopp"), tags: { pt: ["estalo", "bolha", "aparecer"], en: ["bubble", "appear"], es: ["burbuja", "aparecer"], de: ["Blase", "erscheinen"] } },
  click: { name: localizedText("Clique", "Click", "Clic", "Klick"), tags: { pt: ["toque", "botão", "tecla"], en: ["tap", "button", "key"], es: ["toque", "botón"], de: ["Tippen", "Taste"] } },
  whoosh: { name: localizedText("Whoosh", "Whoosh", "Barrido", "Wusch"), tags: { pt: ["transição", "passagem", "vento"], en: ["swoosh", "transition", "swipe"], es: ["transición", "viento"], de: ["Übergang", "Wind"] } },
  ding: { name: localizedText("Plim", "Ding", "Ding", "Ding"), tags: { pt: ["sino", "ding", "acerto"], en: ["bell", "chime", "success"], es: ["campana", "acierto"], de: ["Glocke", "Erfolg"] } },
};

function builtinItem(sound: BuiltinSound): LibraryItem {
  const named = NAMES[sound.id];
  return soundItem({
    id: `sound-${sound.id}`,
    assetId: soundAssetId(sound.id),
    subcategory: sound.group,
    label: { text: named.name },
    tags: named.tags,
    source: OWN_SOURCE,
    durationMs: () => sound.durationMs,
  });
}

export interface MediaSound {
  id: string;
  description: string;
}

export interface MediaTiming {
  durationMs: () => number | undefined;
  assets: LibraryAssets;
}

export function mediaSoundItem(media: MediaSound, timing: MediaTiming): LibraryItem | null {
  const id = `media-${media.id}`;
  if (!LIBRARY_ID_PATTERN.test(id)) return null;
  const name = media.description.trim() || media.id;
  return soundItem({ id, assetId: media.id, subcategory: "mine", label: { text: localizedText(name, name, name, name) }, source: USER_SOURCE, durationMs: timing.durationMs, assets: timing.assets });
}

export const AUDIO_CATEGORY: LibraryCategory = {
  id: AUDIO_CATEGORY_ID,
  panel: "elements",
  label: { key: "studio.library.categories.audio" },
  tile: "sound",
  notes: { video: { key: "studio.library.notes.audio" } },
  subcategories: [
    { id: "mine", label: { key: "studio.library.subcategories.audio.mine" } },
    { id: "interface", label: { key: "studio.library.subcategories.audio.interface" } },
    { id: "effects", label: { key: "studio.library.subcategories.audio.effects" } },
  ],
  items: () => BUILTIN_SOUNDS.map(builtinItem),
};
