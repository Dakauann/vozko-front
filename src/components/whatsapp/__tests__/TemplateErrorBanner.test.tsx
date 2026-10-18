import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TemplateErrorBanner } from "../TemplateErrorBanner";

function renderBanner(details?: string[], code?: string) {
  const onDismiss = vi.fn();
  render(
    <TemplateErrorBanner title="Não foi possível criar" message="Revise o modelo." details={details} code={code} onDismiss={onDismiss} dismissLabel="Fechar" />,
  );
  return onDismiss;
}

describe("TemplateErrorBanner", () => {
  it("is a fault notice with the title, the message, the details and the code", () => {
    renderBanner(["Corpo obrigatório", "Rodapé longo"], "template_body_too_long");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("notice-fault");
    expect(within(alert).getByText("Não foi possível criar")).toBeInTheDocument();
    expect(within(alert).getByText("Revise o modelo.")).toBeInTheDocument();
    expect(within(alert).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Corpo obrigatório", "Rodapé longo"]);
    expect(within(alert).getByText("template_body_too_long")).toBeInTheDocument();
  });

  it("colours only the mark, never the text", () => {
    renderBanner();
    const alert = screen.getByRole("alert");
    expect(alert.querySelector("[class*='destructive']")).toBeNull();
  });

  it("leaves out details and code it was not given", () => {
    renderBanner();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("dismisses", () => {
    const onDismiss = renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
