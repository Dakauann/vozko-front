import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelTile, channelPlate } from "./channel-tile";

describe("channel tiles", () => {
  it("plates Mercado Livre in its yellow with navy ink, never white on yellow", () => {
    expect(channelPlate("mercadolivre")).toBe("bg-[#FFE600] text-[#2D3277]");
    const { container } = render(<ChannelTile channel="mercadolivre" />);
    const glyph = container.querySelector("svg");
    expect(glyph?.getAttribute("class") ?? "").toContain("text-[#2D3277]");
    expect(glyph?.getAttribute("class") ?? "").not.toContain("text-white");
  });

  it("keeps white ink on the dark channel plates", () => {
    expect(channelPlate("telegram")).toBe("bg-[#229ED9] text-white");
    expect(channelPlate("fax")).toBe("tile-neutral");
  });
});
