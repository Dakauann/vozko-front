import { describe, expect, it } from "vitest";

import {
  authorableOptionCount,
  byteLength,
  channelsWithoutDescriptions,
  problemsFor,
  reachFor,
} from "./interactive-reach";
import type { ChannelInteractiveLimits } from "./types";

// The real numbers, so a change to a channel's documented limits breaks a test
// rather than silently changing what the editor promises an author.
const WHATSAPP: ChannelInteractiveLimits = {
  maxOptionsButtons: 3,
  maxOptionsList: 10,
  maxLabelRunes: 20,
  maxPayloadBytes: 200,
  supportsDescriptions: true,
};
const INSTAGRAM: ChannelInteractiveLimits = {
  maxOptionsButtons: 13,
  maxOptionsList: 13,
  maxLabelRunes: 20,
  maxPayloadBytes: 1000,
  supportsDescriptions: false,
};
const TELEGRAM: ChannelInteractiveLimits = {
  maxOptionsButtons: 100,
  maxOptionsList: 100,
  maxLabelRunes: 0,
  maxPayloadBytes: 64,
  supportsDescriptions: false,
};

const ALL = {
  whatsapp: WHATSAPP,
  instagram: INSTAGRAM,
  telegram: TELEGRAM,
};

function statusOn(
  reaches: ReturnType<typeof reachFor>,
  channel: string,
): string {
  return reaches.find((r) => r.channel === channel)?.status ?? "missing";
}

describe("reachFor", () => {
  it("keeps an option inside every channel's cap when it is early enough", () => {
    const reaches = reachFor(
      { id: "sim", title: "Sim" },
      0,
      "buttons",
      ALL,
    );
    expect(reaches.every((r) => r.status === "ok")).toBe(true);
  });

  // The whole point of the annotation: the fourth button is fine on two
  // channels and invisible on the third.
  it("drops the fourth button on WhatsApp but not on Instagram or Telegram", () => {
    const reaches = reachFor(
      { id: "quarta", title: "Quarta opção" },
      3,
      "buttons",
      ALL,
    );
    expect(statusOn(reaches, "whatsapp")).toBe("dropped");
    expect(statusOn(reaches, "instagram")).toBe("ok");
    expect(statusOn(reaches, "telegram")).toBe("ok");
  });

  it("drops the fourteenth option on Instagram, which Telegram still renders", () => {
    const reaches = reachFor({ id: "o14", title: "Opção" }, 13, "list", ALL);
    expect(statusOn(reaches, "instagram")).toBe("dropped");
    expect(statusOn(reaches, "telegram")).toBe("ok");
  });

  it("reports a long label as truncated where a label limit exists", () => {
    const reaches = reachFor(
      { id: "x", title: "Um rótulo bem mais longo que vinte caracteres" },
      0,
      "buttons",
      ALL,
    );
    expect(statusOn(reaches, "whatsapp")).toBe("truncated");
    expect(statusOn(reaches, "instagram")).toBe("truncated");
    // Telegram documents no label limit, so nothing is promised or warned.
    expect(statusOn(reaches, "telegram")).toBe("ok");
  });

  // Telegram's callback_data is documented in BYTES. An id of accented text
  // overflows before its character count suggests, and a truncated payload
  // would come back matching no branch.
  it("measures the option id in bytes, not characters", () => {
    const id = "ç".repeat(40); // 40 characters, 80 bytes
    expect(byteLength(id)).toBe(80);

    const reaches = reachFor({ id, title: "x" }, 0, "buttons", ALL);
    expect(statusOn(reaches, "telegram")).toBe("payload_too_long");
    expect(statusOn(reaches, "instagram")).toBe("ok");
  });

  // An option the channel cannot send at all is worse news than one it will
  // not show, which is worse than one it shows imperfectly.
  it("reports the most consequential verdict when several apply", () => {
    const reaches = reachFor(
      {
        id: "x".repeat(250), // over WhatsApp's 200 and Telegram's 64
        title: "Um rótulo bem mais longo que vinte caracteres",
      },
      50,
      "buttons",
      ALL,
    );
    expect(statusOn(reaches, "telegram")).toBe("payload_too_long");
    expect(statusOn(reaches, "whatsapp")).toBe("payload_too_long");
  });
});

describe("problemsFor", () => {
  // Silence on a healthy option is the design: annotating every row equally
  // would bury the one row that needs attention.
  it("says nothing about an option every channel renders", () => {
    expect(problemsFor({ id: "sim", title: "Sim" }, 0, "buttons", ALL)).toEqual(
      [],
    );
  });

  it("names only the channels with something to report", () => {
    const problems = problemsFor({ id: "q", title: "Q" }, 3, "buttons", ALL);
    expect(problems.map((p) => p.channel)).toEqual(["whatsapp"]);
    expect(problems[0].limit).toBe(3);
  });
});

describe("authorableOptionCount", () => {
  // The editor used to stop at three because that is WhatsApp's cap, which made
  // Telegram's fourth option unauthorable.
  it("uses the most permissive connected channel", () => {
    expect(authorableOptionCount("buttons", ALL, 3)).toBe(100);
    expect(authorableOptionCount("list", { whatsapp: WHATSAPP }, 3)).toBe(10);
  });

  it("falls back when no channel reports limits", () => {
    expect(authorableOptionCount("buttons", {}, 3)).toBe(3);
  });
});

describe("channelsWithoutDescriptions", () => {
  it("names every channel that silently ignores a row description", () => {
    expect(channelsWithoutDescriptions(ALL)).toEqual(["instagram", "telegram"]);
  });
});
