import { describe, expect, it } from "vitest";

import { memberExportQuery } from "./member-export";

describe("memberExportQuery", () => {
  it("joins the chosen groups into one request", () => {
    expect(memberExportQuery({ groupIds: ["g-1", "g-2", "g-1", " "] })).toBe("?groupIds=g-1%2Cg-2");
  });

  it("asks for a whole series", () => {
    expect(memberExportQuery({ seriesId: "s-1" })).toBe("?seriesId=s-1");
  });

  it("can combine groups and a series", () => {
    expect(memberExportQuery({ groupIds: ["g-1"], seriesId: "s-1" })).toBe("?groupIds=g-1&seriesId=s-1");
  });

  it("returns nothing when nothing was chosen", () => {
    expect(memberExportQuery({ groupIds: [] })).toBeNull();
    expect(memberExportQuery({ seriesId: "  " })).toBeNull();
  });
});
