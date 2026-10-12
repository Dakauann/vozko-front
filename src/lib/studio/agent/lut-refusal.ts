import type { LutUse } from "../lut-uses";

export const LUT_REFUSAL_CODE = "lut_unavailable";

export const LUT_LOST = "um LUT do projeto deixou de abrir enquanto os quadros eram desenhados, e nada é gerado sem ele; tente de novo";

export function lutRefusalReason(use: LutUse): string {
  const owner = use.owner.kind === "clip" ? use.owner.clip : use.owner.layer;
  const noun = use.owner.kind === "clip" ? "do clipe" : "da camada";
  const named = owner.name ? ` (${owner.name})` : "";
  return `o LUT ${use.assetId} ${noun} ${owner.id}${named} não pôde ser lido, e nada é gerado sem ele; importe o arquivo .cube de novo e aponte para ele com set_color lut_media_id, ou tire o LUT com set_color clear_color lut`;
}
