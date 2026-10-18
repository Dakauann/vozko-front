import type { FontId } from "../../fonts";
import { DASH_PRESETS } from "../../stroke-presets";
import { OWN_SOURCE, type LibraryCategory, type LibraryItem, type LocalizedText } from "../model";
import { comboLayers, comboRatio, comboSlots, type ComboColor, type ComboRule, type ComboText, type TextCombo } from "../text-combo";

const COMBO_SUBCATEGORIES = ["titles", "promos", "events", "greetings", "stickers", "monograms"] as const;

type Subcategory = (typeof COMBO_SUBCATEGORIES)[number];

function words(pt: string, en: string, es: string, de: string): LocalizedText {
  return { pt, en, es, de };
}

function text(slot: string, sample: LocalizedText, font: FontId, weight: number, size: number, color: ComboColor | null, extra: Partial<ComboText> = {}): ComboText {
  return { kind: "text", slot, sample, font, weight, size, color, ...extra };
}

function rule(width: number, color: ComboColor, gap: number, thickness: number = 0.007): ComboRule {
  return { kind: "rule", width, thickness, color, gap };
}

function combo(subcategory: Subcategory, id: string, name: LocalizedText, tags: TextCombo["tags"], body: Omit<TextCombo, "id" | "subcategory" | "name" | "tags">): TextCombo {
  return { id, subcategory, name, tags, ...body };
}

const SOFT = 0.72;

interface MonogramStyle {
  font: FontId;
  weight: number;
  italic?: boolean;
  letters: string;
  spacing: number;
  paper: `#${string}`;
  ink: `#${string}`;
  ring: `#${string}`;
  shape: "ellipse" | "seal";
}

function monogram(id: string, name: LocalizedText, tags: TextCombo["tags"], style: MonogramStyle, arc: LocalizedText, base: LocalizedText): TextCombo {
  const curved = (slot: string, sample: LocalizedText, curve: number, gap: number) => text(slot, sample, "josefin-sans", 600, 0.05, style.ink, { spacing: 0.22, caps: true, curve, gap });
  return combo("monograms", id, name, tags, {
    align: "center",
    backdrop: { shape: style.shape, fill: style.paper, pad: [0.26, 0.26], square: true, stroke: { color: style.ring, width: 0.012 } },
    parts: [
      curved("arc", arc, 0.55, 0.02),
      text("letters", words(style.letters, style.letters, style.letters, style.letters), style.font, style.weight, 0.26, style.ink, { lineHeight: 1, spacing: style.spacing, italic: style.italic, strokes: [{ color: style.paper, width: 0.05 }], gap: 0.02 }),
      curved("base", base, -0.55, 0),
    ],
  });
}

export const TEXT_COMBOS: readonly TextCombo[] = [
  combo("titles", "classic-serif", words("Clássico serifado", "Classic serif", "Clásico con serifa", "Klassische Serife"), { pt: ["elegante", "livro", "capítulo"], en: ["elegant", "book", "chapter"] }, {
    align: "center",
    parts: [
      text("title", words("Um novo capítulo", "A new chapter", "Un nuevo capítulo", "Ein neues Kapitel"), "playfair-display", 700, 0.15, "ink", { gap: 0.035, lineHeight: 1.05, accent: { word: "last", style: { italic: true, fontWeight: 500 } } }),
      rule(0.16, "#b45309", 0.035),
      text("subtitle", words("Histórias que merecem ser contadas", "Stories worth telling", "Historias que merecen contarse", "Geschichten, die erzählt werden wollen"), "inter", 400, 0.046, "ink", { lines: 2, opacity: SOFT, lineHeight: 1.4 }),
    ],
  }),
  combo("titles", "bold-moves", words("Atitude ousada", "Bold moves", "Pasos audaces", "Mutige Schritte"), { pt: ["ousado", "forte", "moda"], en: ["bold", "strong", "fashion"] }, {
    align: "center",
    parts: [
      text("title", words("ATITUDE ousada", "BOLD moves", "PASOS audaces", "MUTIGE Schritte"), "archivo-black", 400, 0.2, "ink", { gap: 0.03, lineHeight: 1, spacing: -0.02, accent: { word: "last", style: { fontId: "dm-serif-display", fontWeight: 400, italic: true, fill: "#ff4d2e" } } }),
      text("subtitle", words("Para quem não espera", "For people who don't wait", "Para quien no espera", "Für alle, die nicht warten"), "space-grotesk", 500, 0.046, "ink", { opacity: SOFT }),
    ],
  }),
  combo("titles", "editorial", words("Editorial", "Editorial", "Editorial", "Editorial"), { pt: ["revista", "edição", "elegante"], en: ["magazine", "issue", "elegant"] }, {
    align: "center",
    parts: [
      text("title", words("A arte de recomeçar", "The art of starting over", "El arte de empezar de nuevo", "Die Kunst des Neuanfangs"), "cormorant-garamond", 600, 0.17, "ink", { italic: true, lines: 2, lineHeight: 1, gap: 0.04 }),
      rule(0.12, "ink", 0.035, 0.005),
      text("label", words("EDIÇÃO ESPECIAL", "SPECIAL EDITION", "EDICIÓN ESPECIAL", "SONDERAUSGABE"), "josefin-sans", 600, 0.04, "ink", { spacing: 0.3, caps: true, opacity: SOFT }),
    ],
  }),
  combo("titles", "modern-sans", words("Moderno", "Modern", "Moderno", "Modern"), { pt: ["coleção", "marca", "limpo"], en: ["collection", "brand", "clean"] }, {
    align: "center",
    parts: [
      text("title", words("Feito para durar", "Built to last", "Hecho para durar", "Gemacht für lange"), "montserrat", 800, 0.14, "ink", { spacing: -0.02, lineHeight: 1.05, gap: 0.03 }),
      text("subtitle", words("NOVA COLEÇÃO", "NEW COLLECTION", "NUEVA COLECCIÓN", "NEUE KOLLEKTION"), "montserrat", 500, 0.04, "ink", { spacing: 0.18, caps: true, opacity: SOFT }),
    ],
  }),
  combo("titles", "quote", words("Citação", "Quote", "Cita", "Zitat"), { pt: ["frase", "citação", "inspiração"], en: ["quote", "saying", "inspiration"] }, {
    align: "center",
    parts: [
      text("quote", words("“A simplicidade é o último grau de sofisticação.”", "“Simplicity is the ultimate sophistication.”", "“La simplicidad es la máxima sofisticación.”", "“Einfachheit ist die höchste Stufe der Vollendung.”"), "lora", 500, 0.085, "ink", { italic: true, lines: 3, lineHeight: 1.3, gap: 0.04 }),
      rule(0.1, "#0f766e", 0.035),
      text("author", words("LEONARDO DA VINCI", "LEONARDO DA VINCI", "LEONARDO DA VINCI", "LEONARDO DA VINCI"), "inter", 600, 0.036, "ink", { spacing: 0.14, caps: true, opacity: SOFT }),
    ],
  }),
  combo("titles", "launch", words("Lançamento", "Launch", "Lanzamiento", "Launch"), { pt: ["produto", "versão", "tecnologia"], en: ["product", "version", "tech"] }, {
    align: "left",
    parts: [
      text("title", words("Versão 2.0 chegou", "Version 2.0 is here", "Llegó la versión 2.0", "Version 2.0 ist da"), "space-grotesk", 700, 0.15, "ink", { spacing: -0.03, lineHeight: 1, gap: 0.035 }),
      text("detail", words("disponível agora para todos", "available now for everyone", "disponible ahora para todos", "ab sofort für alle verfügbar"), "jetbrains-mono", 400, 0.042, "ink", { opacity: SOFT }),
    ],
  }),
  combo("titles", "minimal", words("Minimalista", "Minimal", "Minimalista", "Minimalistisch"), { pt: ["simples", "leve", "estúdio"], en: ["simple", "light", "studio"] }, {
    align: "center",
    parts: [
      text("title", words("menos é mais", "less is more", "menos es más", "weniger ist mehr"), "outfit", 200, 0.16, "ink", { spacing: -0.03, lineHeight: 1, gap: 0.035, accent: { word: "last", style: { fontWeight: 700 } } }),
      text("subtitle", words("ESTÚDIO DE DESIGN", "DESIGN STUDIO", "ESTUDIO DE DISEÑO", "DESIGNSTUDIO"), "outfit", 400, 0.038, "ink", { spacing: 0.24, caps: true, opacity: SOFT }),
    ],
  }),
  combo("titles", "headline-news", words("Manchete", "Headline", "Titular", "Schlagzeile"), { pt: ["notícia", "urgente", "jornal"], en: ["news", "breaking", "press"] }, {
    align: "left",
    parts: [
      text("tag", words("URGENTE", "BREAKING", "ÚLTIMA HORA", "EILMELDUNG"), "oswald", 600, 0.05, "#ffffff", { spacing: 0.08, caps: true, gap: 0.035, pill: { color: "#dc2626", padX: 0.45, padY: 0.18, radius: 0.2 } }),
      text("title", words("Novidades da semana", "This week's news", "Novedades de la semana", "Neues aus der Woche"), "oswald", 700, 0.14, "ink", { caps: true, lineHeight: 1, lines: 2 }),
    ],
  }),
  combo("titles", "signature", words("Assinatura", "Signature", "Firma", "Signatur"), { pt: ["café", "restaurante", "cardápio"], en: ["cafe", "restaurant", "menu"] }, {
    align: "center",
    parts: [
      text("title", words("Café da manhã", "Breakfast", "Desayuno", "Frühstück"), "great-vibes", 400, 0.2, "ink", { lineHeight: 1.1, gap: 0.03 }),
      text("subtitle", words("SERVIDO DAS 7H ÀS 11H", "SERVED FROM 7 TO 11 AM", "DE 7 A 11 DE LA MAÑANA", "VON 7 BIS 11 UHR"), "eb-garamond", 500, 0.042, "ink", { spacing: 0.22, caps: true, opacity: SOFT }),
    ],
  }),
  combo("promos", "sale-50", words("50% OFF", "50% OFF", "50% de descuento", "50% Rabatt"), { pt: ["promoção", "desconto", "liquidação", "oferta"], en: ["sale", "discount", "offer"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#ffd60a", radius: 0.08, pad: [0.12, 0.11] },
    parts: [
      text("title", words("50% OFF", "50% OFF", "50% DTO.", "50% RABATT"), "bebas-neue", 400, 0.3, "#111111", { lineHeight: 1, gap: 0.02, accent: { word: "last", style: { fill: "#d62828" } } }),
      text("subtitle", words("em toda a loja", "storewide", "en toda la tienda", "auf alles"), "inter", 700, 0.046, "#111111", { spacing: 0.16, caps: true }),
    ],
  }),
  combo("promos", "black-friday", words("Black Friday", "Black Friday", "Black Friday", "Black Friday"), { pt: ["promoção", "novembro", "desconto"], en: ["sale", "november", "discount"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#0a0a0a", pad: [0.14, 0.13] },
    parts: [
      text("title", words("BLACK", "BLACK", "BLACK", "BLACK"), "oswald", 700, 0.27, "#ffffff", { spacing: 0.02, lineHeight: 1, gap: 0.005 }),
      text("outline", words("FRIDAY", "FRIDAY", "FRIDAY", "FRIDAY"), "oswald", 700, 0.27, null, { spacing: 0.02, lineHeight: 1, gap: 0.045, strokes: [{ color: "#ffffff", width: 0.025 }] }),
      rule(0.2, "#facc15", 0.04, 0.01),
      text("subtitle", words("até 70% de desconto", "up to 70% off", "hasta 70% de descuento", "bis zu 70% Rabatt"), "inter", 600, 0.046, "#ffffff", { spacing: 0.12, caps: true }),
    ],
  }),
  combo("promos", "flash-sale", words("Oferta relâmpago", "Flash sale", "Oferta relámpago", "Blitzangebot"), { pt: ["promoção", "faixa", "rápido"], en: ["sale", "ribbon", "limited"] }, {
    align: "center",
    backdrop: { shape: "ribbon", fill: "#e11d48", pad: [0.2, 0.07] },
    parts: [text("title", words("OFERTA RELÂMPAGO", "FLASH SALE", "OFERTA RELÁMPAGO", "BLITZANGEBOT"), "bungee", 400, 0.11, "#ffffff", { lineHeight: 1 })],
  }),
  combo("promos", "price", words("Preço especial", "Special price", "Precio especial", "Sonderpreis"), { pt: ["preço", "valor", "promoção"], en: ["price", "deal", "sale"] }, {
    align: "center",
    parts: [
      text("kicker", words("Só hoje", "Today only", "Solo hoy", "Nur heute"), "fraunces", 600, 0.075, "#c2410c", { italic: true, lineHeight: 1, gap: 0.015 }),
      text("price", words("R$ 49,90", "$49.90", "49,90 €", "49,90 €"), "archivo-black", 400, 0.22, "ink", { spacing: -0.02, lineHeight: 1, gap: 0.03 }),
      text("terms", words("ou 3x sem juros", "or 3 interest free payments", "o 3 cuotas sin interés", "oder in 3 Raten ohne Zinsen"), "inter", 500, 0.04, "ink", { opacity: SOFT }),
    ],
  }),
  combo("promos", "free-shipping", words("Frete grátis", "Free shipping", "Envío gratis", "Gratis Versand"), { pt: ["entrega", "frete", "loja"], en: ["delivery", "shipping", "store"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#0f766e", radius: 0.35, pad: [0.12, 0.08] },
    parts: [
      text("title", words("FRETE GRÁTIS", "FREE SHIPPING", "ENVÍO GRATIS", "GRATIS VERSAND"), "bungee", 400, 0.1, "#ffffff", { lineHeight: 1, gap: 0.02 }),
      text("subtitle", words("em todos os pedidos", "on every order", "en todos los pedidos", "auf jede Bestellung"), "inter", 500, 0.042, "#ccfbf1"),
    ],
  }),
  combo("promos", "new-arrival", words("Novidade", "New in", "Novedad", "Neu"), { pt: ["coleção", "lançamento", "novo"], en: ["collection", "launch", "new"] }, {
    align: "left",
    parts: [
      text("tag", words("NOVIDADE", "NEW IN", "NOVEDAD", "NEU"), "space-grotesk", 700, 0.045, "#ffffff", { spacing: 0.12, caps: true, gap: 0.035, pill: { color: "#2563eb", padX: 0.6, padY: 0.25, radius: 1 } }),
      text("title", words("Chegou a coleção de verão", "The summer collection is here", "Llegó la colección de verano", "Die Sommerkollektion ist da"), "fraunces", 700, 0.13, "ink", { lines: 2, lineHeight: 1.05, spacing: -0.02 }),
    ],
  }),
  combo("promos", "coupon", words("Cupom", "Coupon", "Cupón", "Gutschein"), { pt: ["cupom", "código", "desconto"], en: ["coupon", "code", "discount"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#fff7ed", radius: 0.08, pad: [0.12, 0.1], stroke: { color: "#ea580c", width: 0.01, dash: DASH_PRESETS.dashed } },
    parts: [
      text("label", words("CUPOM", "COUPON", "CUPÓN", "GUTSCHEIN"), "inter", 700, 0.04, "#9a3412", { spacing: 0.26, caps: true, gap: 0.02 }),
      text("code", words("BEMVINDO10", "WELCOME10", "BIENVENIDO10", "WILLKOMMEN10"), "jetbrains-mono", 800, 0.13, "#ea580c", { lineHeight: 1.05, gap: 0.025 }),
      text("subtitle", words("10% na primeira compra", "10% off your first order", "10% en tu primera compra", "10% auf die erste Bestellung"), "inter", 500, 0.042, "#9a3412"),
    ],
  }),
  combo("promos", "last-units", words("Últimas unidades", "Almost gone", "Últimas unidades", "Letzte Stücke"), { pt: ["estoque", "acabando", "urgente"], en: ["stock", "limited", "hurry"] }, {
    align: "center",
    parts: [
      text("title", words("ÚLTIMAS UNIDADES", "ALMOST GONE", "ÚLTIMAS UNIDADES", "LETZTE STÜCKE"), "staatliches", 400, 0.17, "#dc2626", { spacing: 0.02, lineHeight: 1, gap: 0.03 }),
      text("subtitle", words("garanta já a sua", "get yours now", "consigue el tuyo ya", "sichere dir deins"), "inter", 500, 0.045, "ink", { opacity: SOFT }),
    ],
  }),
  combo("promos", "button", words("Botão", "Button", "Botón", "Button"), { pt: ["botão", "chamada", "comprar"], en: ["button", "call to action", "shop"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#4f46e5", radius: 1, pad: [0.1, 0.06] },
    parts: [text("label", words("Compre agora", "Shop now", "Compra ahora", "Jetzt kaufen"), "manrope", 700, 0.1, "#ffffff", { lineHeight: 1 })],
  }),
  combo("promos", "mega-sale", words("Selo de desconto", "Discount burst", "Sello de descuento", "Rabattstern"), { pt: ["selo", "desconto", "estrela"], en: ["badge", "discount", "starburst"] }, {
    align: "center",
    rotation: -8,
    backdrop: { shape: "burst", fill: "#e11d48", pad: [0.22, 0.22], square: true },
    parts: [
      text("value", words("30%", "30%", "30%", "30%"), "titan-one", 400, 0.3, "#ffffff", { lineHeight: 1 }),
      text("label", words("OFF", "OFF", "DTO.", "RABATT"), "titan-one", 400, 0.11, "#ffffff", { lineHeight: 1 }),
    ],
  }),
  combo("events", "invite", words("Convite", "Invitation", "Invitación", "Einladung"), { pt: ["convite", "festa", "evento"], en: ["invite", "party", "event"] }, {
    align: "center",
    parts: [
      text("title", words("Você está convidado", "You're invited", "Estás invitado", "Du bist eingeladen"), "great-vibes", 400, 0.17, "ink", { lineHeight: 1.1, gap: 0.04 }),
      text("date", words("SÁBADO, 18 DE OUTUBRO", "SATURDAY, OCTOBER 18", "SÁBADO, 18 DE OCTUBRE", "SAMSTAG, 18. OKTOBER"), "montserrat", 600, 0.042, "ink", { spacing: 0.2, caps: true, gap: 0.018 }),
      text("place", words("19h, Espaço Aurora", "7 PM, Aurora Hall", "19 h, Espacio Aurora", "19 Uhr, Aurora Saal"), "montserrat", 400, 0.04, "ink", { opacity: SOFT }),
    ],
  }),
  combo("events", "live", words("Ao vivo", "Live", "En vivo", "Live"), { pt: ["live", "webinar", "transmissão"], en: ["live", "webinar", "stream"] }, {
    align: "left",
    parts: [
      text("tag", words("AO VIVO", "LIVE", "EN VIVO", "LIVE"), "inter", 800, 0.045, "#ffffff", { spacing: 0.1, caps: true, gap: 0.035, pill: { color: "#dc2626", padX: 0.55, padY: 0.25, radius: 1 } }),
      text("title", words("Workshop de marketing digital", "Digital marketing workshop", "Taller de marketing digital", "Workshop für digitales Marketing"), "plus-jakarta-sans", 800, 0.12, "ink", { lines: 2, lineHeight: 1.05, spacing: -0.02, gap: 0.025 }),
      text("time", words("Quinta, às 20h", "Thursday at 8 PM", "Jueves a las 20 h", "Donnerstag um 20 Uhr"), "plus-jakarta-sans", 500, 0.045, "ink", { opacity: SOFT }),
    ],
  }),
  combo("events", "rock", words("Rock", "Rock", "Rock", "Rock"), { pt: ["show", "música", "festival"], en: ["concert", "music", "festival"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#111111", pad: [0.14, 0.12] },
    parts: [
      text("title", words("ROCK", "ROCK", "ROCK", "ROCK"), "bungee", 400, 0.3, "#fde047", { lineHeight: 1, gap: 0.04, strokes: [{ color: "#e11d48", width: 0.05 }], effects: [{ type: "drop-shadow", color: "#000000", opacity: 0.55, x: 0, y: 0.04, blur: 0.08 }] }),
      text("subtitle", words("FESTIVAL DE VERÃO", "SUMMER FESTIVAL", "FESTIVAL DE VERANO", "SOMMERFESTIVAL"), "staatliches", 400, 0.075, "#ffffff", { spacing: 0.2 }),
    ],
  }),
  combo("events", "opening", words("Inauguração", "Grand opening", "Inauguración", "Neueröffnung"), { pt: ["abertura", "loja", "evento"], en: ["opening", "store", "event"] }, {
    align: "center",
    parts: [
      text("title", words("Inauguração", "Grand opening", "Inauguración", "Neueröffnung"), "abril-fatface", 400, 0.16, "ink", { lineHeight: 1.05, gap: 0.035 }),
      rule(0.14, "#b45309", 0.035),
      text("subtitle", words("Venha celebrar com a gente", "Come celebrate with us", "Ven a celebrar con nosotros", "Feiert mit uns"), "lora", 500, 0.05, "ink", { italic: true, opacity: SOFT }),
    ],
  }),
  combo("events", "save-the-date", words("Reserve a data", "Save the date", "Reserva la fecha", "Save the Date"), { pt: ["casamento", "data", "noivado"], en: ["wedding", "date", "engagement"] }, {
    align: "center",
    parts: [
      text("title", words("Reserve a data", "Save the date", "Reserva la fecha", "Merkt euch den Termin"), "sacramento", 400, 0.19, "ink", { lineHeight: 1.1, gap: 0.02 }),
      text("date", words("12.12.2026", "12.12.2026", "12.12.2026", "12.12.2026"), "cormorant-garamond", 600, 0.12, "#9f1239", { spacing: 0.08, lineHeight: 1, gap: 0.035 }),
      text("names", words("CASAMENTO DE ANA E LUCAS", "ANA AND LUCAS ARE GETTING MARRIED", "BODA DE ANA Y LUCAS", "HOCHZEIT VON ANA UND LUCAS"), "josefin-sans", 600, 0.034, "ink", { spacing: 0.26, caps: true, lines: 2, opacity: SOFT }),
    ],
  }),
  combo("events", "coming-soon", words("Em breve", "Coming soon", "Próximamente", "Demnächst"), { pt: ["lançamento", "breve", "aguarde"], en: ["launch", "soon", "teaser"] }, {
    align: "center",
    parts: [
      text("title", words("EM BREVE", "COMING SOON", "PRÓXIMAMENTE", "DEMNÄCHST"), "josefin-sans", 300, 0.12, "ink", { spacing: 0.3, caps: true, lineHeight: 1, gap: 0.035 }),
      rule(0.08, "ink", 0.035, 0.005),
      text("subtitle", words("Algo novo está chegando", "Something new is on its way", "Algo nuevo está por llegar", "Etwas Neues kommt"), "inter", 400, 0.045, "ink", { opacity: SOFT }),
    ],
  }),
  combo("events", "spooky", words("Noite do terror", "Spooky", "Noche de miedo", "Gruselnacht"), { pt: ["halloween", "terror", "festa"], en: ["halloween", "spooky", "party"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#1c1917", pad: [0.14, 0.12] },
    parts: [
      text("title", words("Noite do terror", "Spooky night", "Noche de miedo", "Gruselnacht"), "creepster", 400, 0.2, "#a3e635", { lineHeight: 1, gap: 0.035, effects: [{ type: "outer-glow", color: "#a3e635", opacity: 0.55, x: 0, y: 0, blur: 0.25 }] }),
      text("subtitle", words("FESTA DE HALLOWEEN", "HALLOWEEN PARTY", "FIESTA DE HALLOWEEN", "HALLOWEEN PARTY"), "inter", 600, 0.045, "#fafaf9", { spacing: 0.2, caps: true }),
    ],
  }),
  combo("events", "neon", words("Festa neon", "Neon party", "Fiesta neón", "Neonparty"), { pt: ["balada", "neon", "festa"], en: ["club", "neon", "party"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#0b0b1a", radius: 0.06, pad: [0.14, 0.12] },
    parts: [
      text("title", words("FESTA NEON", "NEON PARTY", "FIESTA NEÓN", "NEONPARTY"), "righteous", 400, 0.18, "#f5d0fe", { lineHeight: 1, gap: 0.04, effects: [{ type: "outer-glow", color: "#e879f9", opacity: 0.9, x: 0, y: 0, blur: 0.3 }] }),
      text("time", words("sexta, 23h", "friday, 11 PM", "viernes, 23 h", "Freitag, 23 Uhr"), "righteous", 400, 0.055, "#a5f3fc", { effects: [{ type: "outer-glow", color: "#22d3ee", opacity: 0.8, x: 0, y: 0, blur: 0.3 }] }),
    ],
  }),
  combo("greetings", "birthday", words("Feliz aniversário", "Happy birthday", "Feliz cumpleaños", "Alles Gute"), { pt: ["aniversário", "parabéns", "festa"], en: ["birthday", "party", "celebration"] }, {
    align: "center",
    parts: [
      text("arc", words("HOJE TEM FESTA", "PARTY TIME", "HOY HAY FIESTA", "PARTYZEIT"), "fredoka", 700, 0.07, "#f97316", { spacing: 0.14, caps: true, curve: 0.35, gap: 0.01 }),
      text("title", words("Feliz aniversário", "Happy birthday", "Feliz cumpleaños", "Alles Gute zum Geburtstag"), "pacifico", 400, 0.16, "#db2777", { lineHeight: 1.25, gap: 0.03 }),
      text("subtitle", words("Que seu dia seja incrível", "Have an amazing day", "Que tengas un día increíble", "Hab einen wunderbaren Tag"), "fredoka", 500, 0.05, "ink", { opacity: SOFT }),
    ],
  }),
  combo("greetings", "thank-you", words("Obrigado", "Thank you", "Gracias", "Danke"), { pt: ["agradecimento", "obrigado", "cliente"], en: ["thanks", "gratitude", "customer"] }, {
    align: "center",
    parts: [
      text("title", words("Obrigado!", "Thank you!", "¡Gracias!", "Danke!"), "dancing-script", 700, 0.2, "ink", { lineHeight: 1.15, gap: 0.02 }),
      text("subtitle", words("pela sua preferência", "for choosing us", "por elegirnos", "dass ihr uns gewählt habt"), "inter", 400, 0.046, "ink", { opacity: SOFT }),
    ],
  }),
  combo("greetings", "christmas", words("Feliz Natal", "Merry Christmas", "Feliz Navidad", "Frohe Weihnachten"), { pt: ["natal", "dezembro", "festas"], en: ["christmas", "december", "holidays"] }, {
    align: "center",
    parts: [
      text("title", words("Feliz Natal", "Merry Christmas", "Feliz Navidad", "Frohe Weihnachten"), "great-vibes", 400, 0.2, "#b91c1c", { lineHeight: 1.1, gap: 0.025 }),
      rule(0.14, "#15803d", 0.03),
      text("subtitle", words("e um próspero Ano Novo", "and a happy New Year", "y próspero Año Nuevo", "und ein gutes neues Jahr"), "cormorant-garamond", 600, 0.05, "ink", { spacing: 0.1, caps: true }),
    ],
  }),
  combo("greetings", "new-year", words("Feliz Ano Novo", "Happy New Year", "Feliz Año Nuevo", "Frohes neues Jahr"), { pt: ["ano novo", "réveillon", "festa"], en: ["new year", "celebration", "party"] }, {
    align: "center",
    backdrop: { shape: "rect", fill: "#0f172a", radius: 0.05, pad: [0.14, 0.12] },
    parts: [
      text("title", words("Feliz Ano Novo", "Happy New Year", "Feliz Año Nuevo", "Frohes neues Jahr"), "dm-serif-display", 400, 0.16, "#fde68a", { lineHeight: 1.05, gap: 0.035 }),
      text("subtitle", words("Que venham novos começos", "Here's to new beginnings", "Por nuevos comienzos", "Auf einen neuen Anfang"), "inter", 400, 0.046, "#e2e8f0"),
    ],
  }),
  combo("greetings", "mothers-day", words("Dia das Mães", "Mother's Day", "Día de la Madre", "Muttertag"), { pt: ["mãe", "maio", "carinho"], en: ["mom", "mother", "love"] }, {
    align: "center",
    parts: [
      text("title", words("Feliz Dia das Mães", "Happy Mother's Day", "Feliz Día de la Madre", "Alles Liebe zum Muttertag"), "dancing-script", 600, 0.15, "#be185d", { lineHeight: 1.15, lines: 2, gap: 0.025 }),
      text("subtitle", words("Com todo o nosso carinho", "With all our love", "Con todo nuestro cariño", "Von ganzem Herzen"), "lora", 500, 0.05, "ink", { italic: true, opacity: SOFT }),
    ],
  }),
  combo("greetings", "congrats", words("Parabéns", "Congratulations", "Felicidades", "Glückwunsch"), { pt: ["parabéns", "conquista", "formatura"], en: ["congrats", "achievement", "graduation"] }, {
    align: "center",
    parts: [
      text("title", words("Parabéns!", "Congratulations!", "¡Felicidades!", "Herzlichen Glückwunsch!"), "kaushan-script", 400, 0.18, "#0d9488", { lineHeight: 1.2, gap: 0.025 }),
      text("subtitle", words("Você merece cada conquista", "You earned every bit of it", "Te mereces cada logro", "Du hast es dir verdient"), "nunito", 600, 0.046, "ink", { opacity: SOFT }),
    ],
  }),
  combo("greetings", "welcome", words("Boas-vindas", "Welcome", "Bienvenida", "Willkommen"), { pt: ["bem-vindo", "cliente", "família"], en: ["welcome", "hello", "family"] }, {
    align: "center",
    parts: [
      text("title", words("Bem-vindo!", "Welcome!", "¡Bienvenido!", "Willkommen!"), "lobster", 400, 0.18, "#2563eb", { lineHeight: 1.15, gap: 0.025 }),
      text("subtitle", words("à nossa família", "to the family", "a la familia", "in der Familie"), "nunito", 600, 0.048, "ink", { opacity: SOFT }),
    ],
  }),
  combo("greetings", "with-love", words("Com amor", "With love", "Con amor", "In Liebe"), { pt: ["amor", "namorados", "carinho"], en: ["love", "valentine", "romance"] }, {
    align: "center",
    backdrop: { shape: "heart", fill: "#fb7185", pad: [0.2, 0.3] },
    parts: [text("title", words("Com amor", "With love", "Con amor", "In Liebe"), "sacramento", 400, 0.17, "#ffffff", { lineHeight: 1.1 })],
  }),
  combo("greetings", "good-morning", words("Bom dia", "Good morning", "Buenos días", "Guten Morgen"), { pt: ["bom dia", "manhã", "café"], en: ["morning", "coffee", "hello"] }, {
    align: "center",
    parts: [
      text("title", words("Bom dia!", "Good morning!", "¡Buenos días!", "Guten Morgen!"), "caveat", 700, 0.2, "ink", { lineHeight: 1.1, gap: 0.02 }),
      text("subtitle", words("comece o dia com um sorriso", "start the day with a smile", "empieza el día con una sonrisa", "starte mit einem Lächeln"), "shadows-into-light", 400, 0.06, "#ea580c"),
    ],
  }),
  combo("stickers", "wow", words("Uau", "Wow", "Guau", "Wow"), { pt: ["adesivo", "uau", "surpresa"], en: ["sticker", "wow", "surprise"] }, {
    align: "center",
    rotation: -6,
    parts: [
      text("title", words("UAU!", "WOW!", "¡GUAU!", "WOW!"), "titan-one", 400, 0.3, "#facc15", {
        lineHeight: 1,
        strokes: [
          { color: "#1e1b4b", width: 0.13 },
          { color: "#ffffff", width: 0.06 },
        ],
        effects: [{ type: "drop-shadow", color: "#1e1b4b", opacity: 0.35, x: 0, y: 0.05, blur: 0.06 }],
      }),
    ],
  }),
  combo("stickers", "boom", words("Boom", "Boom", "Bum", "Bumm"), { pt: ["adesivo", "explosão", "quadrinhos"], en: ["sticker", "explosion", "comic"] }, {
    align: "center",
    rotation: -10,
    backdrop: { shape: "burst", fill: "#ef4444", pad: [0.24, 0.24], square: true },
    parts: [text("title", words("BOOM!", "BOOM!", "¡BUM!", "BUMM!"), "bungee", 400, 0.2, "#ffffff", { lineHeight: 1, strokes: [{ color: "#111111", width: 0.08 }] })],
  }),
  combo("stickers", "new-seal", words("Selo novo", "New seal", "Sello nuevo", "Siegel Neu"), { pt: ["selo", "novo", "lançamento"], en: ["seal", "new", "badge"] }, {
    align: "center",
    rotation: 12,
    backdrop: { shape: "seal", fill: "#16a34a", pad: [0.3, 0.3], square: true },
    parts: [
      text("title", words("NOVO", "NEW", "NUEVO", "NEU"), "titan-one", 400, 0.2, "#ffffff", { lineHeight: 1 }),
      text("subtitle", words("na loja", "in store", "en tienda", "im Laden"), "fredoka", 600, 0.06, "#dcfce7", { lineHeight: 1 }),
    ],
  }),
  combo("stickers", "like-it", words("Curtiu?", "Like it?", "¿Te gusta?", "Gefällt's?"), { pt: ["redes sociais", "curtir", "salvar"], en: ["social", "like", "save"] }, {
    align: "center",
    rotation: -4,
    parts: [
      text("title", words("CURTIU?", "LIKE IT?", "¿TE GUSTA?", "GEFÄLLT'S?"), "righteous", 400, 0.1, "#ffffff", { gap: 0.03, pill: { color: "#7c3aed", padX: 0.6, padY: 0.3, radius: 1 } }),
      text("subtitle", words("salve para ver depois", "save it for later", "guárdalo para después", "speicher es dir"), "caveat", 700, 0.075, "ink"),
    ],
  }),
  combo("stickers", "special-offer", words("Oferta especial", "Special offer", "Oferta especial", "Sonderangebot"), { pt: ["oferta", "arco", "hoje"], en: ["offer", "arc", "today"] }, {
    align: "center",
    parts: [
      text("arc", words("OFERTA ESPECIAL", "SPECIAL OFFER", "OFERTA ESPECIAL", "SONDERANGEBOT"), "fredoka", 700, 0.08, "#7c3aed", { spacing: 0.12, caps: true, curve: 0.5, gap: 0.005 }),
      text("title", words("HOJE", "TODAY", "HOY", "HEUTE"), "titan-one", 400, 0.24, "#7c3aed", { lineHeight: 1, effects: [{ type: "drop-shadow", color: "#4c1d95", opacity: 0.3, x: 0, y: 0.04, blur: 0.06 }] }),
    ],
  }),
  combo("stickers", "good-vibes", words("Boas vibrações", "Good vibes", "Buena onda", "Gute Laune"), { pt: ["retrô", "vibe", "adesivo"], en: ["retro", "vibes", "sticker"] }, {
    align: "center",
    rotation: -5,
    parts: [
      text("title", words("Bons tempos", "Good vibes", "Buena onda", "Gute Laune"), "righteous", 400, 0.2, "#fb923c", { lineHeight: 1, gap: 0.03, strokes: [{ color: "#431407", width: 0.06 }], effects: [{ type: "drop-shadow", color: "#431407", opacity: 0.45, x: 0.03, y: 0.05, blur: 0.04 }] }),
      text("subtitle", words("desde 1985", "since 1985", "desde 1985", "seit 1985"), "kaushan-script", 400, 0.07, "ink"),
    ],
  }),
  monogram("monogram-atelier", words("Monograma ateliê", "Atelier monogram", "Monograma taller", "Atelier-Monogramm"), { pt: ["monograma", "selo", "iniciais", "marca"], en: ["monogram", "seal", "initials", "brand"] }, { font: "playfair-display", weight: 700, italic: true, letters: "AB", spacing: -0.2, paper: "#1e3a5f", ink: "#f5e6b8", ring: "#c9a227", shape: "ellipse" }, words("ATELIÊ DE COSTURA", "TAILORING ATELIER", "TALLER DE COSTURA", "SCHNEIDERATELIER"), words("DESDE 2010", "SINCE 2010", "DESDE 2010", "SEIT 2010")),
  monogram("monogram-wedding", words("Monograma casamento", "Wedding monogram", "Monograma de boda", "Hochzeitsmonogramm"), { pt: ["monograma", "casamento", "iniciais", "convite"], en: ["monogram", "wedding", "initials", "invitation"] }, { font: "great-vibes", weight: 400, letters: "A&B", spacing: -0.12, paper: "#fdf6ec", ink: "#8a4b57", ring: "#b76e79", shape: "ellipse" }, words("CASAMENTO", "WEDDING", "BODA", "HOCHZEIT"), words("12.10.2026", "12.10.2026", "12.10.2026", "12.10.2026")),
  monogram("monogram-deco", words("Selo déco", "Deco seal", "Sello déco", "Déco-Siegel"), { pt: ["monograma", "selo", "art déco", "luxo"], en: ["monogram", "seal", "art deco", "luxury"] }, { font: "abril-fatface", weight: 400, letters: "KM", spacing: -0.16, paper: "#0f172a", ink: "#e9c46a", ring: "#e9c46a", shape: "seal" }, words("COLEÇÃO PRIVADA", "PRIVATE COLLECTION", "COLECCIÓN PRIVADA", "PRIVATSAMMLUNG"), words("EDIÇÃO LIMITADA", "LIMITED EDITION", "EDICIÓN LIMITADA", "LIMITIERTE AUFLAGE")),
  monogram("monogram-bistro", words("Monograma bistrô", "Bistro monogram", "Monograma bistró", "Bistro-Monogramm"), { pt: ["monograma", "café", "restaurante", "selo"], en: ["monogram", "cafe", "restaurant", "seal"] }, { font: "dm-serif-display", weight: 400, letters: "CF", spacing: -0.18, paper: "#fffbeb", ink: "#14532d", ring: "#14532d", shape: "ellipse" }, words("CAFÉ E BISTRÔ", "CAFE AND BISTRO", "CAFÉ Y BISTRÓ", "CAFÉ UND BISTRO"), words("FEITO À MÃO", "MADE BY HAND", "HECHO A MANO", "HANDGEMACHT")),
  monogram("monogram-estate", words("Brasão de iniciais", "Estate initials", "Escudo de iniciales", "Initialenwappen"), { pt: ["monograma", "iniciais", "família", "clássico"], en: ["monogram", "initials", "family", "classic"] }, { font: "libre-baskerville", weight: 700, letters: "JRS", spacing: -0.14, paper: "#3f1d2b", ink: "#f8e7d0", ring: "#d4a373", shape: "ellipse" }, words("CASA DE FAMÍLIA", "FAMILY HOUSE", "CASA DE FAMILIA", "FAMILIENHAUS"), words("VINHOS E AZEITES", "WINES AND OILS", "VINOS Y ACEITES", "WEINE UND ÖLE")),
];

function comboItem(combo: TextCombo): LibraryItem {
  const slots = comboSlots(combo);
  return {
    id: `text-combo-${combo.id}`,
    category: "textCombos",
    subcategory: combo.subcategory,
    editors: ["image", "video"],
    ratio: comboRatio(combo),
    label: { text: combo.name },
    ...(combo.tags ? { tags: combo.tags } : {}),
    preview: { kind: "render" },
    source: OWN_SOURCE,
    template: { kind: "layers", slots, build: (ctx) => ({ layers: comboLayers(combo, ctx) }) },
  };
}

const COMBO_ITEMS: readonly LibraryItem[] = TEXT_COMBOS.map(comboItem);

export const TEXT_COMBOS_CATEGORY: LibraryCategory = {
  id: "textCombos",
  panel: "text",
  label: { key: "studio.library.categories.textCombos" },
  tile: "poster",
  subcategories: COMBO_SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.combos.${id}` } })),
  items: () => COMBO_ITEMS,
};
