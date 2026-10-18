import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Bell, ChatCircle, Robot, User, Users } from "@/components/icons";

import { ExplainerScene } from "./ExplainerScene";
import type { SceneSpec } from "./catalog/types";

const text = (key: string) => `[${key}]`;

const SCENES: Record<SceneSpec["kind"], { spec: SceneSpec; shows: string[] }> = {
  flow: { spec: { kind: "flow", nodes: [{ icon: ChatCircle, label: "message" }, { icon: Robot, label: "ai", tone: "accent" }] }, shows: ["[message]", "[ai]"] },
  compare: {
    spec: { kind: "compare", off: { label: "off", rows: [{ label: "hidden" }] }, on: { label: "on", rows: [{ label: "shown" }] } },
    shows: ["[off]", "[on]", "[hidden]", "[shown]"],
  },
  timeline: { spec: { kind: "timeline", events: [{ at: 0.2, icon: Bell, label: "alert" }], start: "now", end: "later" }, shows: ["[alert]", "[now]", "[later]"] },
  fanout: {
    spec: { kind: "fanout", source: { icon: ChatCircle, label: "chat" }, targets: [{ icon: User, label: "ana" }, { icon: Users, label: "team" }], picked: 0 },
    shows: ["[chat]", "[ana]", "[team]"],
  },
  waves: { spec: { kind: "waves" }, shows: ["[grow]", "[slow]", "[hold]"] },
};

describe("ExplainerScene", () => {
  it.each(Object.entries(SCENES))("draws the %s scene with its labels", (_, { spec, shows }) => {
    render(<ExplainerScene spec={spec} text={text} label="what it does" />);

    expect(screen.getByRole("img", { name: "what it does" })).toBeInTheDocument();
    for (const label of shows) expect(screen.getByText(label)).toBeInTheDocument();
  });
});
