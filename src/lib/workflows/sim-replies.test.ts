import { describe, expect, it } from "vitest";

import { customerReplyCommand, locationReply, mediaReply } from "./sim-replies";

describe("customerReplyCommand", () => {
  it("sends typed text as a plain reply", () => {
    expect(customerReplyCommand({ kind: "text", text: "oi" })).toEqual({ type: "reply", data: { text: "oi" } });
  });

  it("sends a tapped button or list row as a selection with its id and title, as the webhook delivers it", () => {
    expect(customerReplyCommand({ kind: "selection", choice: { kind: "button", id: "sim", title: "Sim" } })).toEqual({
      type: "reply_selection",
      data: { kind: "button", id: "sim", title: "Sim" },
    });
    expect(customerReplyCommand({ kind: "selection", choice: { kind: "list", id: "m", title: "Manhã" } })).toEqual({
      type: "reply_selection",
      data: { kind: "list", id: "m", title: "Manhã" },
    });
  });

  it("sends a location and a media reply with only the fields that were filled", () => {
    expect(customerReplyCommand({ kind: "location", latitude: -23.5, longitude: -46.6 })).toEqual({
      type: "reply_location",
      data: { latitude: -23.5, longitude: -46.6 },
    });
    expect(customerReplyCommand({ kind: "location", latitude: -23.5, longitude: -46.6, name: "Campus", address: "Rua A, 1" })).toEqual({
      type: "reply_location",
      data: { latitude: -23.5, longitude: -46.6, name: "Campus", address: "Rua A, 1" },
    });
    expect(customerReplyCommand({ kind: "media", media: "image", url: "https://cdn.test/a.png", caption: "RG" })).toEqual({
      type: "reply_media",
      data: { kind: "image", url: "https://cdn.test/a.png", caption: "RG" },
    });
  });
});

describe("locationReply", () => {
  const draft = { latitude: "-23.5505", longitude: "-46.6333", name: "", address: "" };

  it("reads the coordinates and keeps a trimmed name and address", () => {
    expect(locationReply({ ...draft, name: " Campus ", address: "Rua A, 1 " })).toEqual({
      kind: "location",
      latitude: -23.5505,
      longitude: -46.6333,
      name: "Campus",
      address: "Rua A, 1",
    });
    expect(locationReply(draft)).toEqual({ kind: "location", latitude: -23.5505, longitude: -46.6333 });
  });

  it("refuses a position the channel would not deliver: empty, not a number, out of range or the null island", () => {
    expect(locationReply({ ...draft, latitude: "" })).toBeNull();
    expect(locationReply({ ...draft, longitude: "abc" })).toBeNull();
    expect(locationReply({ ...draft, latitude: "91" })).toBeNull();
    expect(locationReply({ ...draft, latitude: "0", longitude: "0" })).toBeNull();
  });
});

describe("mediaReply", () => {
  it("keeps the kind, the trimmed url and the caption", () => {
    expect(mediaReply({ kind: "video", url: " https://cdn.test/v.mp4 ", caption: " Veja " })).toEqual({
      kind: "media",
      media: "video",
      url: "https://cdn.test/v.mp4",
      caption: "Veja",
    });
  });

  it("names a document after the file in its url, as the customer's phone would", () => {
    expect(mediaReply({ kind: "document", url: "https://cdn.test/docs/hist%C3%B3rico.pdf?x=1", caption: "" })).toEqual({
      kind: "media",
      media: "document",
      url: "https://cdn.test/docs/hist%C3%B3rico.pdf?x=1",
      filename: "histórico.pdf",
    });
  });

  it("drops the caption of a sticker, which has none on the channel", () => {
    expect(mediaReply({ kind: "sticker", url: "https://cdn.test/s.webp", caption: "oi" })).toEqual({ kind: "media", media: "sticker", url: "https://cdn.test/s.webp" });
  });

  it("refuses a url that is not https", () => {
    expect(mediaReply({ kind: "image", url: "", caption: "" })).toBeNull();
    expect(mediaReply({ kind: "image", url: "http://cdn.test/a.png", caption: "" })).toBeNull();
    expect(mediaReply({ kind: "image", url: "arquivo.png", caption: "" })).toBeNull();
  });
});

describe("form replies", () => {
  it("answers a waiting form with its answers, or follows the no reply exit", () => {
    expect(customerReplyCommand({ kind: "form", answers: { name: "Ana" } })).toEqual({ type: "form_reply", data: { answers: { name: "Ana" } } });
    expect(customerReplyCommand({ kind: "form_unanswered" })).toEqual({ type: "form_reply", data: { outcome: "no_reply" } });
  });
});
