import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { DashboardMainContent } from "../sidebar-context";

describe("dashboard main content", () => {
  it("keeps clear of the open assistant sheet through the one shared reserve", () => {
    render(<DashboardMainContent>page</DashboardMainContent>);
    expect(screen.getByRole("main").style.paddingRight).toBe("var(--dock-right-reserve)");
  });
});
