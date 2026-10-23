import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { audit, problemsOf, SRC } from "@/lib/coworker/manual-path-audit";

import { IMAGE_OPERATIONS } from "./image-ops";
import { ELO_TOOL_PATHS, IMAGE_MANUAL_PATHS, STUDIO_TOOL_PATHS, VIDEO_MANUAL_PATHS } from "./manual-paths";
import { VIDEO_OPERATIONS } from "./video-ops";

const TOOLS_DIR = join(SRC, "..", "..", "vozko-back", "usecases", "copilot", "copilottools", "studiotools");

function goToolNames(): string[] {
  const sources = readdirSync(TOOLS_DIR)
    .filter((file) => file.startsWith("studio_") && file.endsWith(".go") && !file.endsWith("_test.go"))
    .map((file) => readFileSync(join(TOOLS_DIR, file), "utf8"));
  const pattern = /(?:[Dd]efinition\(|name:\s*)"(studio_[a-z_]+)"/g;
  return [...new Set(sources.flatMap((source) => [...source.matchAll(pattern)].map((match) => match[1])))];
}

describe("manual paths for Elo operations", () => {
  it("gives every video operation a manual path a person can find", () => {
    expect(audit(VIDEO_OPERATIONS, VIDEO_MANUAL_PATHS)).toEqual([]);
  });

  it("gives every image operation a manual path a person can find", () => {
    expect(audit(IMAGE_OPERATIONS, IMAGE_MANUAL_PATHS)).toEqual([]);
  });

  it("covers every studio tool Elo has on the server", () => {
    const names = goToolNames();
    expect(names).toEqual(expect.arrayContaining(["studio_export", "studio_listen", "studio_edit_video"]));
    expect(names.flatMap((name) => problemsOf(name, STUDIO_TOOL_PATHS[name]))).toEqual([]);
  });

  it("gives the ad placement look, the new project and the question card a manual path", () => {
    const copilotTools = join(TOOLS_DIR, "..");
    const sources = ["adtools/ad_placement_look_tool.go", "studiotools/new_project_tool.go", "platformtools/ask_user_tool.go"].map((file) => readFileSync(join(copilotTools, file), "utf8")).join("\n");
    for (const name of Object.keys(ELO_TOOL_PATHS)) {
      expect(sources, name).toContain(`Definition("${name}"`);
    }
    expect(Object.keys(ELO_TOOL_PATHS).flatMap((name) => problemsOf(name, ELO_TOOL_PATHS[name]))).toEqual([]);
  });

  it("registers no operation Elo does not have", () => {
    const known = new Set<string>([...VIDEO_OPERATIONS, ...IMAGE_OPERATIONS]);
    expect([...Object.keys(VIDEO_MANUAL_PATHS), ...Object.keys(IMAGE_MANUAL_PATHS)].filter((name) => !known.has(name))).toEqual([]);
  });
});
