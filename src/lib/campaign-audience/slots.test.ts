import { describe, expect, it } from "vitest";

import { slotSegments } from "./slots";
import type { VariableCount } from "./types";

function variable(key: string, name: string, header: boolean): VariableCount {
  return { key, name, header, missing: 0, policy: "", suggested: false, choiceRequired: false };
}

const POSITIONAL = [variable("1", "1", true), variable("2", "1", false), variable("3", "2", false)];

describe("slotSegments", () => {
  it("maps header placeholders to the header slots the server lists first", () => {
    expect(slotSegments("Oferta {{1}}", true, POSITIONAL)).toEqual([
      { text: "Oferta " },
      { text: "{{1}}", variable: POSITIONAL[0], position: 0 },
    ]);
  });

  it("maps body placeholders to the body slots after the header", () => {
    expect(slotSegments("Olá {{1}}, seu código é {{2}}.", false, POSITIONAL)).toEqual([
      { text: "Olá " },
      { text: "{{1}}", variable: POSITIONAL[1], position: 1 },
      { text: ", seu código é " },
      { text: "{{2}}", variable: POSITIONAL[2], position: 2 },
      { text: "." },
    ]);
  });

  it("keeps named parameters by their names and tolerates spaces in the braces", () => {
    const named = [variable("1", "loja", true), variable("2", "nome", false)];
    expect(slotSegments("Oi {{ nome }}", false, named)).toEqual([
      { text: "Oi " },
      { text: "{{ nome }}", variable: named[1], position: 1 },
    ]);
  });

  it("leaves a placeholder the server does not list as a plain marked slot", () => {
    expect(slotSegments("Oi {{9}}", false, POSITIONAL)).toEqual([{ text: "Oi " }, { text: "{{9}}", name: "9" }]);
  });
});
