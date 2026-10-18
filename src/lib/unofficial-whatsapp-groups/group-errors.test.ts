import { describe, expect, it } from "vitest";

import { groupErrorKey } from "./group-errors";

describe("groupErrorKey", () => {
  it.each([
    ["that is not a WhatsApp group invite link", "inviteInvalid"],
    ["unofficial whatsapp instance is not connected", "numberOffline"],
    ["this number's session is no longer valid; reconnect it", "numberReconnect"],
    ["number not found", "numberOutOfScope"],
    ["that number is not one of your numbers", "numberOutOfScope"],
    ["none of your connected numbers is in this group", "noConnectedNumber"],
    ["choose at least one number", "noNumbers"],
    ["a group name is required", "nameRequired"],
    ["group name exceeds the 25 character limit", "nameTooLong"],
    ["group description exceeds the 512 character limit", "descriptionTooLong"],
    ["group category exceeds the 60 character limit", "categoryTooLong"],
    ["whatsapp is currently restricting new conversations from this number", "restricted"],
    ["WhatsApp is currently restricting this number", "restricted"],
    ["the connected number is not an admin of this group", "notGroupAdmin"],
    ["join not found", "joinNotFound"],
  ])("maps %s", (message, key) => {
    expect(groupErrorKey(message)).toBe(key);
  });

  it("leaves unknown messages alone", () => {
    expect(groupErrorKey("upstream exploded")).toBeNull();
    expect(groupErrorKey(undefined)).toBeNull();
  });
});
