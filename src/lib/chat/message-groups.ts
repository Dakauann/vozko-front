export type GroupPosition = "single" | "first" | "middle" | "last";

export const GROUP_GAP_MS = 5 * 60 * 1000;

export interface GroupMember {
  author: string;
  at: string;
}

export function joinsGroup(previous: GroupMember | null, current: GroupMember): boolean {
  if (previous === null || previous.author !== current.author) return false;
  const gap = new Date(current.at).getTime() - new Date(previous.at).getTime();
  return gap >= 0 && gap <= GROUP_GAP_MS;
}

export function groupPosition(joinsPrevious: boolean, joinsNext: boolean): GroupPosition {
  if (joinsPrevious && joinsNext) return "middle";
  if (joinsPrevious) return "last";
  if (joinsNext) return "first";
  return "single";
}

export function groupPositions(members: ReadonlyArray<GroupMember | null>): Array<GroupPosition | null> {
  const joined = members.map((member, index) => (member === null ? false : joinsGroup(members[index - 1] ?? null, member)));
  return members.map((member, index) => (member === null ? null : groupPosition(joined[index], joined[index + 1] ?? false)));
}

export function joinedEdges(position: GroupPosition): { top: boolean; bottom: boolean } {
  return {
    top: position === "middle" || position === "last",
    bottom: position === "first" || position === "middle",
  };
}

export function opensGroup(position: GroupPosition): boolean {
  return position === "first" || position === "single";
}
