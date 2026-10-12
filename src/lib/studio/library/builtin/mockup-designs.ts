import { circle, polyline, roundedRect } from "../decor/geometry";
import { filled, holed, stroked } from "../decor/parts";
import { mockupRatio, type MockupDesign } from "../mockup";
import { localizedText as t, OWN_SOURCE, type LibraryItem, type LibraryLocale, type LocalizedText } from "../model";
import { emojiMarkup, svgDataUrl } from "../sets/format";
import type { MockupSubcategory } from "./mockups";

const BODY = "#1c1c1f";
const BEZEL_DETAIL = "#3f3f46";
const DECK = "#a1a1aa";
const DECK_SHADE = "#71717a";
const WINDOW = "#f4f4f5";
const EDGE = "#d4d4d8";
const PAPER = "#ffffff";
const TEXT = "#27272a";
const MUTED = "#a1a1aa";

function screenHole(design: Pick<MockupDesign, "screen">): string {
  const { x, y, w, h, radius } = design.screen;
  return roundedRect(x, y, w, h, radius);
}

const PHONE_SCREEN = { x: 5, y: 14, w: 90, h: 172, radius: 6 };
const PHONE: MockupDesign = {
  w: 100,
  h: 200,
  screen: PHONE_SCREEN,
  below: [holed(`${roundedRect(0, 0, 100, 200, 12)} ${screenHole({ screen: PHONE_SCREEN })}`, BODY), filled(`${roundedRect(40, 6, 20, 2.4, 1.2)} ${circle(33, 7.2, 1.5)}`, BEZEL_DETAIL)],
};

const TABLET_SCREEN = { x: 8, y: 10, w: 134, h: 180, radius: 3 };
const TABLET: MockupDesign = {
  w: 150,
  h: 200,
  screen: TABLET_SCREEN,
  below: [holed(`${roundedRect(0, 0, 150, 200, 10)} ${screenHole({ screen: TABLET_SCREEN })}`, BODY), filled(circle(75, 5, 1.5), BEZEL_DETAIL)],
};

const LAPTOP_SCREEN = { x: 18, y: 7, w: 124, h: 76, radius: 0 };
const LAPTOP: MockupDesign = {
  w: 160,
  h: 100,
  screen: LAPTOP_SCREEN,
  below: [
    holed(`${roundedRect(12, 1, 136, 88, 5)} ${screenHole({ screen: LAPTOP_SCREEN })}`, BODY),
    filled("M0 89 L160 89 L156 96 Q155 99 151 99 L9 99 Q5 99 4 96 Z", DECK),
    filled(roundedRect(68, 89, 24, 2.4, 1.2), DECK_SHADE),
  ],
};

const BROWSER_SCREEN = { x: 1.5, y: 14, w: 137, h: 84.5, radius: 0 };
const BROWSER: MockupDesign = {
  w: 140,
  h: 100,
  screen: BROWSER_SCREEN,
  below: [
    holed(`${roundedRect(0, 0, 140, 100, 4)} ${screenHole({ screen: BROWSER_SCREEN })}`, WINDOW),
    stroked(roundedRect(0.5, 0.5, 139, 99, 3.6), EDGE, 1),
    filled([7, 13, 19].map((x) => circle(x, 7, 2)).join(" "), MUTED),
    filled(roundedRect(28, 3.5, 92, 7, 3.5), PAPER),
    stroked(roundedRect(28, 3.5, 92, 7, 3.5), EDGE, 0.6),
  ],
};

const POST_SCREEN = { x: 0, y: 18, w: 100, h: 100, radius: 0 };
const POST: MockupDesign = {
  w: 100,
  h: 134,
  screen: POST_SCREEN,
  below: [
    holed(`${roundedRect(0, 0, 100, 134, 3)} ${screenHole({ screen: POST_SCREEN })}`, PAPER),
    stroked(roundedRect(0.3, 0.3, 99.4, 133.4, 2.8), EDGE, 0.6),
    filled(circle(9, 9, 5), EDGE),
    filled(roundedRect(18, 5.5, 30, 3, 1.5), TEXT),
    filled(`${roundedRect(18, 10.5, 18, 2.4, 1.2)} ${[86, 90, 94].map((x) => circle(x, 9, 0.9)).join(" ")} ${roundedRect(4, 128, 62, 2.4, 1.2)}`, MUTED),
    stroked(
      [
        "M8 126 C4 123 3 120 5 118.5 C6.5 117.4 8 118 8 119.5 C8 118 9.5 117.4 11 118.5 C13 120 12 123 8 126 Z",
        `${roundedRect(17, 117.6, 8, 6.4, 3)} M19 124 L18 126.4 L21.4 124`,
        polyline([{ x: 30, y: 125 }, { x: 36, y: 119 }]) + " " + polyline([{ x: 32.4, y: 118.6 }, { x: 36, y: 119 }, { x: 35.8, y: 122.4 }]),
      ].join(" "),
      TEXT,
      1,
    ),
  ],
};

const STORY_SCREEN = { x: 0, y: 0, w: 90, h: 160, radius: 6 };
const STORY: MockupDesign = {
  w: 90,
  h: 160,
  screen: STORY_SCREEN,
  below: [stroked(roundedRect(-0.4, -0.4, 90.8, 160.8, 6.4), EDGE, 0.8)],
  above: [
    filled(roundedRect(5, 4, 25.3, 1.2, 0.6), PAPER),
    filled(`${roundedRect(32.3, 4, 25.3, 1.2, 0.6)} ${roundedRect(59.6, 4, 25.4, 1.2, 0.6)}`, PAPER, 0.5),
    filled(`${circle(10.5, 12, 4)} ${roundedRect(17, 10.6, 22, 2.8, 1.4)}`, PAPER),
    stroked(`${polyline([{ x: 80, y: 9.5 }, { x: 85, y: 14.5 }])} ${polyline([{ x: 85, y: 9.5 }, { x: 80, y: 14.5 }])}`, PAPER, 1),
    stroked(`${roundedRect(5, 146, 66, 9, 4.5)} M80 154 C76 151 75 148.6 76.6 147.2 C78 146.2 79.3 146.8 80 148 C80.7 146.8 82 146.2 83.4 147.2 C85 148.6 84 151 80 154 Z`, PAPER, 0.9),
  ],
};

interface MockupSpec {
  id: string;
  subcategory: MockupSubcategory;
  name: LocalizedText;
  tags: Partial<Record<LibraryLocale, readonly string[]>>;
  design: MockupDesign;
}

const MOCKUPS: readonly MockupSpec[] = [
  { id: "mockup-phone", subcategory: "devices", name: t("Celular", "Phone", "Móvil", "Smartphone"), tags: { pt: ["smartphone", "tela", "aplicativo"], en: ["smartphone", "screen", "app"], es: ["teléfono", "pantalla"], de: ["handy", "bildschirm"] }, design: PHONE },
  { id: "mockup-tablet", subcategory: "devices", name: t("Tablet", "Tablet", "Tableta", "Tablet"), tags: { pt: ["tela"], en: ["screen"], es: ["pantalla"], de: ["bildschirm"] }, design: TABLET },
  { id: "mockup-laptop", subcategory: "devices", name: t("Notebook", "Laptop", "Portátil", "Laptop"), tags: { pt: ["computador", "tela"], en: ["computer", "screen"], es: ["ordenador", "pantalla"], de: ["computer", "bildschirm"] }, design: LAPTOP },
  { id: "mockup-browser", subcategory: "devices", name: t("Janela do navegador", "Browser window", "Ventana del navegador", "Browserfenster"), tags: { pt: ["site", "página"], en: ["website", "page"], es: ["sitio web"], de: ["webseite"] }, design: BROWSER },
  { id: "mockup-post", subcategory: "social", name: t("Post de rede social", "Social post", "Publicación social", "Social-Media-Beitrag"), tags: { pt: ["feed", "publicação", "rede social"], en: ["feed", "post", "social media"], es: ["feed", "redes sociales"], de: ["feed", "beitrag"] }, design: POST },
  { id: "mockup-story", subcategory: "social", name: t("Story", "Story", "Historia", "Story"), tags: { pt: ["stories", "vertical", "rede social"], en: ["stories", "vertical", "social media"], es: ["historias", "vertical"], de: ["stories", "vertikal"] }, design: STORY },
];

function previewOf(design: MockupDesign): string {
  const slot = filled(screenHole(design), EDGE);
  return svgDataUrl(emojiMarkup({ w: design.w, h: design.h, p: [...design.below, slot, ...(design.above ?? [])] }));
}

function mockupItem(spec: MockupSpec): LibraryItem {
  return {
    id: spec.id,
    category: "mockups",
    subcategory: spec.subcategory,
    editors: ["image", "video"],
    ratio: mockupRatio(spec.design),
    label: { text: spec.name },
    tags: spec.tags,
    preview: { kind: "deferred", load: async () => ({ kind: "image", src: previewOf(spec.design) }) },
    source: OWN_SOURCE,
    template: { kind: "mockup", design: spec.design },
  };
}

export const MOCKUP_ITEMS: readonly LibraryItem[] = MOCKUPS.map(mockupItem);

