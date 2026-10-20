import { describe, expect, it } from "vitest";

import { groupMimeTypes, groupState, toggleGroup } from "./mime-groups";

const allowed = [
  "application/gzip",
  "application/zip",
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "text/plain",
  "video/mp4",
  "application/x-new-thing",
];

describe("groupMimeTypes", () => {
  it("groups the types the backend allows under friendly groups, in a fixed order, keeping unknown ones apart", () => {
    expect(groupMimeTypes(allowed)).toEqual([
      { group: "pdf", types: ["application/pdf"] },
      { group: "word", types: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
      { group: "excel", types: ["application/vnd.ms-excel"] },
      { group: "powerpoint", types: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
      { group: "images", types: ["image/jpeg", "image/png"] },
      { group: "text", types: ["text/plain"] },
      { group: "video", types: ["video/mp4"] },
      { group: "archives", types: ["application/gzip", "application/zip"] },
      { group: "other", types: ["application/x-new-thing"] },
    ]);
  });

  it("leaves out groups with no allowed type", () => {
    expect(groupMimeTypes(["application/pdf"])).toEqual([{ group: "pdf", types: ["application/pdf"] }]);
  });
});

describe("groupState", () => {
  const images = ["image/jpeg", "image/png"];

  it("tells whether a group is fully, partly or not picked", () => {
    expect(groupState(["image/jpeg", "image/png", "application/pdf"], images)).toBe("all");
    expect(groupState(["image/jpeg"], images)).toBe("some");
    expect(groupState(["application/pdf"], images)).toBe("none");
  });

  it("shows nothing picked when the field accepts every type", () => {
    expect(groupState(undefined, images)).toBe("none");
    expect(groupState([], images)).toBe("none");
  });
});

describe("toggleGroup", () => {
  it("adds a whole group in the allowed order and removes it again", () => {
    const withImages = toggleGroup(["application/pdf"], ["image/png", "image/jpeg"], true, allowed);
    expect(withImages).toEqual(["application/pdf", "image/jpeg", "image/png"]);
    expect(toggleGroup(withImages, ["image/jpeg", "image/png"], false, allowed)).toEqual(["application/pdf"]);
  });

  it("starts from nothing picked when the field accepted every type", () => {
    expect(toggleGroup(undefined, ["application/pdf"], true, allowed)).toEqual(["application/pdf"]);
  });

  it("completes a partly picked group", () => {
    expect(toggleGroup(["image/jpeg"], ["image/jpeg", "image/png"], true, allowed)).toEqual(["image/jpeg", "image/png"]);
  });

  it("goes back to an empty list, which means every type, when the last group is removed", () => {
    expect(toggleGroup(["application/pdf"], ["application/pdf"], false, allowed)).toEqual([]);
  });
});
