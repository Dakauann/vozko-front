import { describe, expect, it } from "vitest";

import type { WorkspaceMember } from "@/lib/workspace/types";

import { membersWithoutDepartment } from "./coverage";
import type { Department, DepartmentMember } from "./types";

const member = (id: string, userId: string, role: WorkspaceMember["role"] = "member") =>
  ({ id, userId, role, username: id, email: `${id}@x.com` }) as WorkspaceMember;

const department = (id: string) => ({ id, name: id }) as Department;

const assignment = (memberId: string, userId?: string) => ({ memberId, userId }) as DepartmentMember;

describe("membersWithoutDepartment", () => {
  const ana = member("m-ana", "u-ana");
  const bruno = member("m-bruno", "u-bruno");
  const owner = member("m-owner", "u-owner", "owner");
  const admin = member("m-admin", "u-admin", "admin");

  it("lists the people in no department, leaving owners and admins out", () => {
    const result = membersWithoutDepartment([ana, bruno, owner, admin], [department("d1")], { d1: [assignment("m-ana")] });
    expect(result?.map((m) => m.id)).toEqual(["m-bruno"]);
  });

  it("matches a membership recorded by user id as well", () => {
    expect(membersWithoutDepartment([ana], [department("d1")], { d1: [assignment("other", "u-ana")] })).toEqual([]);
  });

  it("does not answer until every department's members are known", () => {
    expect(membersWithoutDepartment([ana], [department("d1"), department("d2")], { d1: [] })).toBeNull();
  });

  it("counts everyone scoped when no department exists yet", () => {
    expect(membersWithoutDepartment([ana, owner], [], {})?.map((m) => m.id)).toEqual(["m-ana"]);
  });
});
