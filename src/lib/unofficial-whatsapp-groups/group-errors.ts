type GroupErrorKey =
  | "inviteInvalid"
  | "numberOffline"
  | "numberReconnect"
  | "numberOutOfScope"
  | "noConnectedNumber"
  | "noNumbers"
  | "nameRequired"
  | "nameTooLong"
  | "descriptionTooLong"
  | "categoryTooLong"
  | "restricted"
  | "notGroupAdmin"
  | "joinNotFound"
  | "noInviteLink"
  | "numberAlreadyInGroup";

const MATCHERS: [RegExp, GroupErrorKey][] = [
  [/not a whatsapp group invite link/i, "inviteInvalid"],
  [/instance is not connected/i, "numberOffline"],
  [/no longer valid; reconnect/i, "numberReconnect"],
  [/^number not found$|not one of your numbers/i, "numberOutOfScope"],
  [/none of your connected numbers/i, "noConnectedNumber"],
  [/choose at least one number/i, "noNumbers"],
  [/group name is required/i, "nameRequired"],
  [/group name exceeds/i, "nameTooLong"],
  [/group description exceeds/i, "descriptionTooLong"],
  [/group category exceeds/i, "categoryTooLong"],
  [/currently restricting/i, "restricted"],
  [/not an admin of this group/i, "notGroupAdmin"],
  [/^join not found$/i, "joinNotFound"],
  [/no earlier join left an invite link/i, "noInviteLink"],
  [/number is already in this group/i, "numberAlreadyInGroup"],
];

export function groupErrorKey(message: string | undefined): GroupErrorKey | null {
  if (!message) return null;
  const text = message.trim();
  return MATCHERS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
