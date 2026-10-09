import { describe, expect, it } from "vitest";

import { cuesOnTimeline, parseCaptionCues, parseTimestamp } from "./caption-cues";

describe("caption cues", () => {
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
    expect(parseCaptionCues(vtt)).toEqual([
      { startMs: 0, endMs: 2000, text: "Olá pessoal\ntudo bem?" },
      { startMs: 2500, endMs: 3250, text: "Tom & Jerry" },
    ]);
  });

  it("reads SubRip files with numbered cues, comma milliseconds, position hints and override tags", () => {
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:02,500",
      "{\\an8}Olá <i>mundo</i>",
      "",
      "2",
      "00:00:03,000 --> 00:00:04,000 X1:10 X2:20 Y1:5 Y2:9",
      "Segunda",
      "linha",
      " ",
      "3",
      "00:00:05,000 --> 00:00:06,000",
      "Terceira",
      "",
    ].join("\r\n");
    expect(parseCaptionCues(srt)).toEqual([
      { startMs: 1000, endMs: 2500, text: "Olá mundo" },
      { startMs: 3000, endMs: 4000, text: "Segunda\nlinha" },
      { startMs: 5000, endMs: 6000, text: "Terceira" },
    ]);
  });

  it("finds no cues in text that is not a caption file", () => {
    expect(parseCaptionCues("isto não é uma legenda\n\nnem isto")).toEqual([]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCaptionCues("WEBVTT\n\n")).toEqual([]);
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
