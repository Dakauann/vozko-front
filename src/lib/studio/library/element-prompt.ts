export const ELEMENT_STYLES = ["illustration", "threeD", "sticker", "photo"] as const;

export type ElementStyle = (typeof ELEMENT_STYLES)[number];

export const ELEMENT_PROMPT_LIMIT = 1000;

const STYLE_TEXT: Readonly<Record<ElementStyle, string>> = {
  illustration: "flat vector illustration with clean shapes and a limited palette",
  threeD: "glossy 3D rendered icon with soft studio lighting and rounded clay-like forms",
  sticker: "die-cut sticker with a thick white outline and bold colors",
  photo: "realistic product photo of the object",
};

export function elementPrompt(description: string, style: ElementStyle): string | null {
  const subject = description.trim().replace(/\s+/g, " ").slice(0, ELEMENT_PROMPT_LIMIT);
  if (subject === "") return null;
  return `${subject}. A single isolated subject as a ${STYLE_TEXT[style]}, centered with generous margin, on a plain solid light gray background, no shadow on the background, no text, no frame, no other objects.`;
}

export function elementStyleFor(categoryId: string): ElementStyle {
  return categoryId === "threeD" ? "threeD" : "illustration";
}
