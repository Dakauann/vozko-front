import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStickToBottom } from "./use-stick-to-bottom";

function Scroller({ content, anchor }: { content: string; anchor?: "bottom" | "top" }) {
  const { scrollRef } = useStickToBottom(content, "conversation", anchor);
  return (
    <div
      data-testid="scroller"
      ref={(element) => {
        if (element && !Object.hasOwn(element, "scrollHeight")) Object.defineProperty(element, "scrollHeight", { value: 900 });
        scrollRef.current = element;
      }}
    >
      <div>{content}</div>
    </div>
  );
}

describe("useStickToBottom", () => {
  it("opens at the latest content", () => {
    const { getByTestId } = render(<Scroller content="a" />);
    expect(getByTestId("scroller").scrollTop).toBe(900);
  });

  it("opens at the top when anchored there, and stays put as content changes", () => {
    const { getByTestId, rerender } = render(<Scroller content="a" anchor="top" />);
    expect(getByTestId("scroller").scrollTop).toBe(0);
    rerender(<Scroller content="b" anchor="top" />);
    expect(getByTestId("scroller").scrollTop).toBe(0);
  });

  it("goes back to the latest content when the top anchor is released", () => {
    const { getByTestId, rerender } = render(<Scroller content="a" anchor="top" />);
    rerender(<Scroller content="b" anchor="bottom" />);
    expect(getByTestId("scroller").scrollTop).toBe(900);
  });
});
