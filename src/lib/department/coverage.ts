import type { WorkspaceMember } from "@/lib/workspace/types";

import type { Department, DepartmentMember } from "./types";

export function scopedByDepartment(member: WorkspaceMember): boolean {
  return member.role !== "owner" && member.role !== "admin";
}

export function membersWithoutDepartment(
  members: WorkspaceMember[],
  departments: Department[],
  membersByDepartment: Record<string, DepartmentMember[]>,
): WorkspaceMember[] | null {
  const scoped = members.filter(scopedByDepartment);
  if (departments.length === 0) return scoped;
  if (!departments.every((d) => membersByDepartment[d.id] !== undefined)) return null;
  const assigned = new Set<string>();
  for (const list of Object.values(membersByDepartment)) {
    for (const m of list) {
      assigned.add(m.memberId);
      if (m.userId) assigned.add(m.userId);
    }
  }
  return scoped.filter((m) => !assigned.has(m.id) && !assigned.has(m.userId));
}
