import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MERCADOLIVRE_BLOCK_SUBSTATUSES } from "./window";

const SERVER_WINDOW = resolve(__dirname, "../../../../vozko-back/domain/mercadolivre/window.go");
const SUBSTATUS_CONSTANT = /Substatus\s*=\s*"([a-z_]+)"/g;

describe("Mercado Livre block substatuses", () => {
  it("lists exactly the substatuses the server maps to a closed window", () => {
    const server = [...readFileSync(SERVER_WINDOW, "utf8").matchAll(SUBSTATUS_CONSTANT)].map((match) => match[1]);
    expect(server.length).toBeGreaterThan(0);
    expect([...MERCADOLIVRE_BLOCK_SUBSTATUSES].sort()).toEqual(server.sort());
  });
});
