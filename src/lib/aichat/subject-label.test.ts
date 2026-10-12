import { describe, expect, it } from "vitest";

import { subjectLabelOf } from "./subject-label";

const known: Record<string, string> = {
  "skill.direcao-de-arte": "Art direction",
  "skill.design-de-imagem": "Image design",
};
const translated = (key: string) => known[key] ?? null;

describe("subjectLabelOf", () => {
  it("translates a single subject by its key", () => {
    expect(subjectLabelOf({ kind: "skill", key: "direcao-de-arte", label: "Direção de arte" }, translated)).toBe("Art direction");
  });

  it("translates each skill of a batch load", () => {
    expect(subjectLabelOf({ kind: "skill", key: "direcao-de-arte,design-de-imagem", label: "Direção de arte, Design de imagem" }, translated)).toBe(
      "Art direction, Image design",
    );
  });

  it("falls back to the server label when any part is unknown", () => {
    expect(subjectLabelOf({ kind: "skill", key: "direcao-de-arte,nova", label: "Direção de arte, Nova" }, translated)).toBe("Direção de arte, Nova");
  });
});
