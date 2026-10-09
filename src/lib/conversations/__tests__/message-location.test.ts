import { describe, expect, it } from "vitest";

import { locationPlace, messageLocation, readMessageLocation } from "@/lib/conversations/message-location";

describe("readMessageLocation", () => {
  it("reads the location the server attached to a message", () => {
    expect(
      readMessageLocation({ latitude: -23.5, longitude: -46.8, name: " Casa ", address: "R. das Acácias, 120", candidate: true }),
    ).toEqual({ latitude: -23.5, longitude: -46.8, name: "Casa", address: "R. das Acácias, 120", candidate: true });
  });

  it("leaves out empty name and address", () => {
    expect(readMessageLocation({ latitude: -23.5, longitude: -46.8, name: "", candidate: false })).toEqual({
      latitude: -23.5,
      longitude: -46.8,
      candidate: false,
    });
  });

  it("never treats a location without an explicit candidate verdict as one", () => {
    expect(readMessageLocation({ latitude: -23.5, longitude: -46.8 })?.candidate).toBe(false);
    expect(readMessageLocation({ latitude: -23.5, longitude: -46.8, candidate: "true" })?.candidate).toBe(false);
  });

  it.each([
    undefined,
    null,
    "location",
    [],
    { latitude: "-23.5", longitude: -46.8 },
    { latitude: -23.5 },
    { latitude: Number.NaN, longitude: -46.8 },
    { latitude: 91, longitude: -46.8 },
    { latitude: 0, longitude: 0 },
  ])("refuses %j", (raw) => {
    expect(readMessageLocation(raw)).toBeUndefined();
  });
});

describe("messageLocation", () => {
  it("adds the location field only when the message carries one", () => {
    expect(messageLocation({ location: { latitude: -23.5, longitude: -46.8, candidate: true } })).toEqual({
      location: { latitude: -23.5, longitude: -46.8, candidate: true },
    });
    expect(messageLocation({ text: "oi" })).toEqual({});
  });
});

describe("locationPlace", () => {
  it("joins the name and the address the lead shared", () => {
    expect(locationPlace({ latitude: 1, longitude: 1, name: "Casa", address: "R. das Acácias", candidate: true })).toBe(
      "Casa, R. das Acácias",
    );
  });

  it("is empty when the lead shared only coordinates", () => {
    expect(locationPlace({ latitude: 1, longitude: 1, candidate: true })).toBe("");
  });
});
