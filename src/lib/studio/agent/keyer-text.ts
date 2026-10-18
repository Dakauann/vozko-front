import type { ClipItemsRefusal } from "../clip-items";
import type { KeyerEdit, KeyerRefusal } from "../keyer-edit";
import type { VideoDocument } from "../document";
import { clipAccessText } from "./lane-keys";

export interface KeyerWords {
  name: string;
  setOp: string;
  animateOp: string;
  values: string;
}

export type KeyerOpResult = { ok: true; document: VideoDocument } | { ok: false; reason: string };

function keyerRefusalText(reason: ClipItemsRefusal | KeyerRefusal, clipId: string | undefined, words: KeyerWords): string {
  switch (reason) {
    case "missing":
    case "locked":
      return clipAccessText(reason, clipId);
    case "notVisual":
    case "notKeyable":
      return `o clipe ${clipId} não é vídeo nem imagem; o ${words.name} vale só para clipes de vídeo e imagem`;
    case "off":
      return `o clipe ${clipId} ainda não tem ${words.name}; ligue com ${words.setOp}`;
    case "animated":
      return `esse valor do ${words.name} tem chaves; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com ${words.animateOp}`;
    case "outside":
      return `as chaves precisam ficar entre 0 e a duração do clipe ${clipId}`;
    case "invalid":
      return `o ${words.name} ficaria inválido; confira ${words.values}`;
  }
}

export function settledKeyer(edit: KeyerEdit, clipId: string | undefined, words: KeyerWords): KeyerOpResult {
  return edit.ok ? edit : { ok: false, reason: keyerRefusalText(edit.reason, clipId, words) };
}
