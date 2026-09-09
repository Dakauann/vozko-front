/**
 * Which conversation statuses an operator may move to from where they are.
 *
 * A conversation opens as "new", is worked as "ongoing" and ends "finished".
 * Finishing is terminal from the operator's side — reopening happens by the
 * customer writing again, not by a menu — so a finished conversation offers
 * nothing here rather than offering a move that the server would refuse.
 *
 * Pure, and shared: the centre pane's status menu and a floating window's
 * actions must never disagree about what is possible, which is exactly what
 * happens when the same little switch is written twice.
 */

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
