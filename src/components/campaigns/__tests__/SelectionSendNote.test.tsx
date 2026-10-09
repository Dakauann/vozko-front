import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

import { SelectionSendNote } from "../SelectionSendNote";

describe("SelectionSendNote", () => {
  it("explains a send prepared from leads by default", () => {
    render(<SelectionSendNote />);
    expect(screen.getByRole("note")).toHaveTextContent("leadSends.campaign.fromLeads");
  });

  it.each(["contentLocked", "templateLocked", "contactsLocked"] as const)("explains the %s reason", (reason) => {
    render(<SelectionSendNote reason={reason} />);
    expect(screen.getByRole("note")).toHaveTextContent(`leadSends.campaign.${reason}`);
  });

  it("keeps its notice look when the caller adds spacing", () => {
    render(<SelectionSendNote reason="templateLocked" className="mt-2" />);
    const note = screen.getByRole("note");
    expect(note).toHaveClass("notice", "notice-info", "mt-2");
  });
});
