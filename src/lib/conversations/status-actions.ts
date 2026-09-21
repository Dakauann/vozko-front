
export type NextConversationStatus = "ongoing" | "finished";

export function nextConversationStatuses(
  current: string | undefined | null,
): NextConversationStatus[] {
  switch (current) {
    case "finished":
      return [];
    case "ongoing":
      return ["finished"];
    default:
      return ["ongoing", "finished"];
  }
}
