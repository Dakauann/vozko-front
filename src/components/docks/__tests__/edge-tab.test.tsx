import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { EDGE_TAB_WIDTH } from "@/lib/docks/edge-rail";

import { EdgeTab } from "../edge-tab";

const stylesheet = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");

function railWidth(): string {
  return document.documentElement.style.getPropertyValue("--dock-rail-w");
}

function tab(slot: "upper" | "lower", status: "idle" | "live" | "alert" = "idle") {
  return <EdgeTab slot={slot} label={slot} tabLabel={slot} icon={null} onClick={() => {}} status={status} />;
}

describe("edge tab rail", () => {
  it("publishes its footprint while either tab shows and clears it when both are gone", () => {
    const upper = render(tab("upper"));
    const lower = render(tab("lower"));
    expect(railWidth()).toBe(EDGE_TAB_WIDTH);

    upper.unmount();
    expect(railWidth()).toBe(EDGE_TAB_WIDTH);

    lower.unmount();
    expect(railWidth()).toBe("0px");
  });

  it("always shows at full size with its icon and label, as before the rail change", () => {
    const { getByRole, getByText, unmount } = render(<EdgeTab slot="upper" label="Abrir Elo" tabLabel="Elo" icon={null} onClick={() => {}} />);
    expect(getByRole("button").className).toContain("h-28 w-9");
    expect(getByText("Elo").className).not.toContain("opacity-0");
    unmount();
  });

  it("never takes page width: only the open assistant sheet pushes the page", () => {
    expect(stylesheet).toMatch(/--dock-right-reserve: var\(--assistant-sheet-w, 0px\);/);
  });

  it("keeps floating windows clear of the resting rail and the open assistant sheet", () => {
    expect(stylesheet).toMatch(/--dock-float-reserve: calc\(var\(--assistant-sheet-w, 0px\) \+ var\(--dock-rail-w, 0px\)\);/);
  });
});
