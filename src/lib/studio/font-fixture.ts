import { FONT_IDS, STUDIO_FONTS } from "./fonts";

export const FONT_FIXTURE_PATH = "vozko-back/domain/studio/testdata/studio_fonts.json";

export function fontFixture(): string {
  const fonts = FONT_IDS.map((id) => ({ id, family: STUDIO_FONTS[id].family, category: STUDIO_FONTS[id].category }));
  return `${JSON.stringify({ fonts }, null, 2)}\n`;
}
