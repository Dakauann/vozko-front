import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { AdPage } from "@/lib/advertising/types";

const requestLink = vi.fn();
const confirmLink = vi.fn();
vi.mock("@/app/actions/advertising", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/actions/advertising")>()),
  requestNumberLinkAction: (...args: unknown[]) => requestLink(...args),
  confirmNumberLinkAction: (...args: unknown[]) => confirmLink(...args),
}));

import { LinkWhatsAppNumber } from "./link-whatsapp-number";

const labels = pt.adsWizard.promotion.linkNumber;

const page: AdPage = {
  pageId: "page-1",
  name: "Vozko Technology LTDA",
  canAdvertise: true,
  leadTermsAccepted: true,
  numbers: [],
  linkable: [{ kind: "official", label: "Vozkoia Dev", number: "5511965467700" }],
};

function renderLink(target: AdPage = page, onLinked = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <LinkWhatsAppNumber accountId="acc-1" page={target} onLinked={onLinked} />
    </NextIntlClientProvider>,
  );
  return onLinked;
}

describe("LinkWhatsAppNumber", () => {
  beforeEach(() => {
    requestLink.mockReset();
    confirmLink.mockReset();
  });

  it("asks Meta for the code, then links the number with the code the user types", async () => {
    requestLink.mockResolvedValue({ data: null });
    confirmLink.mockResolvedValue({ data: { ...page, whatsAppNumber: "+55 11 96546-7700" } });
    const onLinked = renderLink();

    fireEvent.click(screen.getByRole("button", { name: labels.sendCode }));
    await waitFor(() => expect(requestLink).toHaveBeenCalledWith("acc-1", "page-1", "5511965467700"));

    const code = await screen.findByLabelText(labels.code);
    fireEvent.change(code, { target: { value: "83569" } });
    fireEvent.click(screen.getByRole("button", { name: labels.confirm }));

    await waitFor(() => expect(confirmLink).toHaveBeenCalledWith("acc-1", "page-1", "5511965467700", "83569"));
    expect(onLinked).toHaveBeenCalled();
    expect(await screen.findByText(labels.linked)).toBeTruthy();
  });

  it("explains a code Meta did not accept and keeps the field to try again", async () => {
    requestLink.mockResolvedValue({ data: null });
    confirmLink.mockResolvedValue({ error: "refused", code: "page_link_refused", status: 409 });
    const onLinked = renderLink();
    fireEvent.click(screen.getByRole("button", { name: labels.sendCode }));
    fireEvent.change(await screen.findByLabelText(labels.code), { target: { value: "11111" } });
    fireEvent.click(screen.getByRole("button", { name: labels.confirm }));
    expect(await screen.findByRole("alert")).toHaveTextContent(pt.adsErrors.page_link_refused);
    expect(screen.getByLabelText(labels.code)).toBeTruthy();
    expect(onLinked).not.toHaveBeenCalled();
  });

  it("cannot confirm before a code is typed", async () => {
    requestLink.mockResolvedValue({ data: null });
    renderLink();
    fireEvent.click(screen.getByRole("button", { name: labels.sendCode }));
    await screen.findByLabelText(labels.code);
    expect(screen.getByRole("button", { name: labels.confirm })).toBeDisabled();
  });

  it("says when no number of the workspace can go on this page", () => {
    renderLink({ ...page, linkable: [] });
    expect(screen.getByText(labels.noneLinkable)).toBeTruthy();
    expect(screen.queryByRole("button", { name: labels.sendCode })).toBeNull();
  });
});
