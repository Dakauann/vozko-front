import { describe, expect, it } from "vitest";

import { readRcsTranscript, readSmsTranscript } from "@/lib/carrier-messaging/transcript";
import { carouselFixture } from "@/lib/rcs/test-fixtures";

describe("readRcsTranscript", () => {
  it("reads the content the RCS adapter writes on the transcript row", () => {
    const metadata = { rcs: { reference: "ref", step: "rcs", class: "single", content: carouselFixture() } };
    expect(readRcsTranscript(metadata)).toEqual({ content: carouselFixture(), billingClass: "single" });
  });

  it("reads plain text content without a class", () => {
    expect(readRcsTranscript({ rcs: { content: { text: "Oi" } } })).toEqual({ content: { text: "Oi" } });
  });

  it("gives up on content it cannot read so the bubble shows the plain text", () => {
    expect(readRcsTranscript({ rcs: { content: { cards: [{ suggestions: [{ kind: "teleport", label: "x" }] }] } } })).toBeNull();
    expect(readRcsTranscript({ rcs: { content: "Oi" } })).toBeNull();
    expect(readRcsTranscript({ sms: { segments: 1 } })).toBeNull();
    expect(readRcsTranscript(null)).toBeNull();
  });
});

describe("readSmsTranscript", () => {
  it("reads the segment count", () => {
    expect(readSmsTranscript({ sms: { reference: "ref", step: "sms", segments: 2 } })).toEqual({ segments: 2 });
  });

  it("ignores missing or invalid counts", () => {
    expect(readSmsTranscript({ sms: { segments: 0 } })).toBeNull();
    expect(readSmsTranscript({ sms: { segments: "2" } })).toBeNull();
    expect(readSmsTranscript({ rcs: {} })).toBeNull();
  });
});
