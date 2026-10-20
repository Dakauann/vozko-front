import type { NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";

export function sharedPostingSeats(groups: { numbers: NumberSeat[] }[]): NumberSeat[] {
  if (groups.length === 0) return [];
  const [first, ...rest] = groups;
  return first.numbers.filter(
    (seat) => seat.canPost && rest.every((group) => group.numbers.some((other) => other.instanceId === seat.instanceId && other.canPost)),
  ).map((seat) => ({
    ...seat,
    connected: seat.connected && rest.every((group) => group.numbers.find((other) => other.instanceId === seat.instanceId)?.connected ?? false),
  }));
}

export function usableSeats(seats: NumberSeat[]): NumberSeat[] {
  return seats.filter((seat) => seat.canPost && seat.connected);
}

export type CampaignLaunchBlock = "noGroups" | "noShared" | "allOffline";

export function campaignLaunchBlock(groups: { numbers: NumberSeat[] }[]): CampaignLaunchBlock | null {
  if (groups.length === 0) return "noGroups";
  if (groups.some((group) => group.numbers.some((seat) => seat.canPost))) return null;
  if (groups.some((group) => group.numbers.some((seat) => !seat.connected))) return "allOffline";
  return "noShared";
}
