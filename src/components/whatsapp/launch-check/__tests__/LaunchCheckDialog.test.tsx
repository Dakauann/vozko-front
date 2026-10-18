import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { LaunchReport } from "@/lib/whatsapp-campaigns/launch-check";

const getLaunchCheck = vi.fn();
const startCampaign = vi.fn();

vi.mock("@/app/actions/whatsapp-campaigns", () => ({
  getWhatsAppCampaignLaunchCheckAction: (...args: unknown[]) => getLaunchCheck(...args),
  startWhatsAppCampaignAction: (...args: unknown[]) => startCampaign(...args),
}));

import { LaunchCheckDialog } from "../LaunchCheckDialog";
import { useLaunchCheck, type LaunchRefusal } from "../use-launch-check";

const copy = ptMessages.launchCheck;

const clean: LaunchReport = { findings: [], fingerprint: "", blocks: false, needsConfirmation: false };
const risky: LaunchReport = {
  findings: [
    { code: "template_red", level: "confirm" },
    { code: "last_run_failures", level: "confirm", observed: 0.2, limit: 0.15 },
    { code: "opted_out_pending", level: "advice", observed: 3 },
  ],
  fingerprint: "fp-1",
  blocks: false,
  needsConfirmation: true,
};
const blocked: LaunchReport = { findings: [{ code: "phone_unavailable", level: "block" }], fingerprint: "", blocks: true, needsConfirmation: false };

const started = vi.fn();
const refused = vi.fn<(refusal: LaunchRefusal) => void>();

function Host() {
  const check = useLaunchCheck({ campaignId: "camp-1", onStarted: started, onRefused: refused });
  return (
    <>
      <button type="button" onClick={() => void check.request()}>
        start
      </button>
      <LaunchCheckDialog check={check} links={{ templateId: "tpl-1" }} />
    </>
  );
}

function renderHost() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <Host />
    </NextIntlClientProvider>,
  );
}

const ok = { response: {}, error: null, errorCode: undefined, errorExpected: undefined };

describe("LaunchCheckDialog", () => {
  beforeEach(() => {
    getLaunchCheck.mockReset();
    startCampaign.mockReset();
    started.mockReset();
    refused.mockReset();
  });

  it("starts at once when nothing needs attention", async () => {
    getLaunchCheck.mockResolvedValue({ report: clean, error: null });
    startCampaign.mockResolvedValue(ok);
    renderHost();

    fireEvent.click(screen.getByText("start"));

    await waitFor(() => expect(started).toHaveBeenCalled());
    expect(startCampaign).toHaveBeenCalledWith("camp-1", undefined);
    expect(screen.queryByText(copy.title)).toBeNull();
  });

  it("never lets a blocked campaign start", async () => {
    getLaunchCheck.mockResolvedValue({ report: blocked, error: null });
    renderHost();

    fireEvent.click(screen.getByText("start"));

    expect(await screen.findByText(copy.codes.phone_unavailable.title)).toBeTruthy();
    expect(screen.getByText(copy.fix.phone)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.start }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText(copy.confirm)).toBeNull();
  });

  it("starts with the fingerprint only after the risks are confirmed", async () => {
    getLaunchCheck.mockResolvedValue({ report: risky, error: null });
    startCampaign.mockResolvedValue(ok);
    renderHost();

    fireEvent.click(screen.getByText("start"));
    await screen.findByText(copy.codes.template_red.title);
    expect(screen.getByText("20% das mensagens falharam na Meta, acima de 15%.")).toBeTruthy();
    expect(screen.getByText(copy.fix.template).getAttribute("href")).toBe("/dashboard/whatsapp-templates/tpl-1");
    const startButton = screen.getByRole("button", { name: copy.start });
    expect(startButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(startButton);

    await waitFor(() => expect(started).toHaveBeenCalled());
    expect(startCampaign).toHaveBeenCalledWith("camp-1", "fp-1");
  });

  it("reviews again when the situation changed before the start", async () => {
    getLaunchCheck.mockResolvedValueOnce({ report: risky, error: null }).mockResolvedValueOnce({ report: { ...risky, fingerprint: "fp-2" }, error: null });
    startCampaign.mockResolvedValue({ response: null, error: "changed", errorCode: "campaign_launch_unconfirmed", errorExpected: undefined });
    renderHost();

    fireEvent.click(screen.getByText("start"));
    await screen.findByText(copy.codes.template_red.title);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: copy.start }));

    expect(await screen.findByText(copy.changed)).toBeTruthy();
    expect((screen.getByRole("checkbox") as HTMLButtonElement).getAttribute("data-state")).toBe("unchecked");
    expect(started).not.toHaveBeenCalled();
    expect(refused).not.toHaveBeenCalled();
  });

  it("reports a check it could not read instead of starting", async () => {
    getLaunchCheck.mockResolvedValue({ report: null, errorCode: "campaign_not_found", error: "nope" });
    renderHost();

    fireEvent.click(screen.getByText("start"));

    await waitFor(() => expect(refused).toHaveBeenCalledWith({ code: "campaign_not_found", message: "nope" }));
    expect(startCampaign).not.toHaveBeenCalled();
  });
});
