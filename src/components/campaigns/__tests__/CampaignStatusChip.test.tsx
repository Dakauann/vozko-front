import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATUS_TONE as EMAIL_TONE } from "@/lib/email-campaigns/status";

import { CampaignStatusChip } from "../CampaignStatusChip";

const TONE_CLASS = {
  outline: "border-border",
  neutral: "bg-[hsl(var(--plate-neutral))]",
  muted: "bg-muted",
  healthy: "bg-healthy",
  warning: "bg-warning",
} as const;

describe("CampaignStatusChip", () => {
  it.each([
    ["DRAFT", EMAIL_TONE.draft],
    ["READY", EMAIL_TONE.ready],
    ["SCHEDULED", EMAIL_TONE.scheduled],
    ["RUNNING", EMAIL_TONE.running],
    ["PAUSED", EMAIL_TONE.paused],
  ])("gives %s the tone email uses", (status, tone) => {
    render(<CampaignStatusChip status={status} label={status} />);
    expect(screen.getByText(status)).toHaveClass(TONE_CLASS[tone as keyof typeof TONE_CLASS]);
  });
});
