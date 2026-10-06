import { describe, expect, it } from "vitest";

import { cuesOnTimeline, parseTimestamp, parseVtt } from "./vtt";

describe("WebVTT", () => {
  it("parses timestamps with and without hours", () => {
    expect(parseTimestamp("00:00:01.500")).toBe(1500);
    expect(parseTimestamp("01:02.25")).toBe(62_250);
    expect(parseTimestamp("1:00:00,000")).toBe(3_600_000);
    expect(parseTimestamp("nope")).toBeNull();
  });

  it("reads cues with ids, settings, tags and multiple lines", () => {
    const vtt = [
      "﻿WEBVTT",
      "",
      "NOTE gerado",
      "",
      "1",
      "00:00:00.000 --> 00:00:02.000 align:center",
      "Olá <b>pessoal</b>",
      "tudo bem?",
      "",
      "00:00:04.000 --> 00:00:03.000",
      "invertido",
      "",
      "00:02.500 --> 00:03.250",
      "Tom &amp; Jerry",
      "",
    ].join("\r\n");
    expect(parseVtt(vtt)).toEqual([
      { startMs: 0, endMs: 2000, text: "Olá pessoal\ntudo bem?" },
      { startMs: 2500, endMs: 3250, text: "Tom & Jerry" },
    ]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseVtt("WEBVTT\n\n")).toEqual([]);
  });
});

describe("cuesOnTimeline", () => {
  it("moves source cues to where the clip plays and cuts them at the trim", () => {
    const cues = [
      { startMs: 0, endMs: 1000, text: "antes" },
      { startMs: 1500, endMs: 2500, text: "corta" },
      { startMs: 3000, endMs: 4000, text: "dentro" },
      { startMs: 5500, endMs: 7000, text: "fim" },
      { startMs: 7000, endMs: 8000, text: "depois" },
    ];
    expect(cuesOnTimeline(cues, { startMs: 10_000, trimInMs: 2000, durationMs: 4000 })).toEqual([
      { text: "corta", startMs: 10_000, endMs: 10_500 },
      { text: "dentro", startMs: 11_000, endMs: 12_000 },
      { text: "fim", startMs: 13_500, endMs: 14_000 },
    ]);
  });
});
