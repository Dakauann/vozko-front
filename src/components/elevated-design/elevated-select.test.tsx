import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ElevatedSelect, ElevatedSelectItem } from "./elevated-select";

describe("ElevatedSelect accessible name", () => {
  it("names the trigger with the aria-label it was given", () => {
    render(
      <ElevatedSelect value="a" onValueChange={() => {}} aria-label="Campo da coluna bairro">
        <ElevatedSelectItem value="a">Bairro</ElevatedSelectItem>
      </ElevatedSelect>,
    );

    expect(screen.getByRole("combobox", { name: "Campo da coluna bairro" })).toBeInTheDocument();
  });

  it("names a custom trigger the same way", () => {
    render(
      <ElevatedSelect value="a" onValueChange={() => {}} aria-label="Ordenar" trigger={<button type="button">a</button>}>
        <ElevatedSelectItem value="a">A</ElevatedSelectItem>
      </ElevatedSelect>,
    );

    expect(screen.getByRole("combobox", { name: "Ordenar" })).toBeInTheDocument();
  });

  it("points the trigger at a label elsewhere on the page", () => {
    render(
      <>
        <span id="column-label">Coluna telefone</span>
        <ElevatedSelect value="a" onValueChange={() => {}} aria-labelledby="column-label">
          <ElevatedSelectItem value="a">WhatsApp</ElevatedSelectItem>
        </ElevatedSelect>
      </>,
    );

    expect(screen.getByRole("combobox", { name: "Coluna telefone" })).toBeInTheDocument();
  });
});
