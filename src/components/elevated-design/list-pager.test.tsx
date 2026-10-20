import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListPager } from "./list-pager";

const labels = { previousLabel: "Anterior", nextLabel: "Próxima", pageLabel: "Página 1 de 3" };

describe("ListPager", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<ListPager page={1} totalPages={1} onPage={vi.fn()} {...labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("moves one page at a time and cannot go before the first page", () => {
    const onPage = vi.fn();
    render(<ListPager page={1} totalPages={3} onPage={onPage} {...labels} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("cannot go past the last page and is fully disabled while a page loads", () => {
    const { rerender } = render(<ListPager page={3} totalPages={3} onPage={vi.fn()} {...labels} />);
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    rerender(<ListPager page={2} totalPages={3} onPage={vi.fn()} disabled {...labels} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });
});
