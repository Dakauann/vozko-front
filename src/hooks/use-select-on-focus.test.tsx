import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSelectOnFocus } from "./use-select-on-focus";

function Field({ value }: { value: string }) {
  const select = useSelectOnFocus();
  return <input aria-label="name" defaultValue={value} {...select} />;
}

describe("useSelectOnFocus", () => {
  it("selects the whole value when the field gets focus, so typing replaces it", () => {
    render(<Field value="Nova campanha de Leads" />);
    const input = screen.getByLabelText("name") as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Nova campanha de Leads".length);
  });

  it("keeps the selection through the click that focused the field, then lets the next click place the cursor", () => {
    render(<Field value="Leads" />);
    const input = screen.getByLabelText("name") as HTMLInputElement;
    fireEvent.focus(input);
    expect(fireEvent.mouseUp(input)).toBe(false);
    expect(fireEvent.mouseUp(input)).toBe(true);
  });
});
