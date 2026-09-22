import { describe, expect, it } from "vitest";

import { ChannelAvatar } from "./channel-avatar";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";

import ptMessages from "@/i18n/messages/pt.json";


function renderAvatar(props: Parameters<typeof ChannelAvatar>[0]) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ChannelAvatar {...props} />
    </NextIntlClientProvider>,
  );
}

const GROUP_LABEL = ptMessages.common.groupConversation;

describe("ChannelAvatar group badge", () => {
  it("marks a group that HAS a photo — the case with no marker at all before", () => {
    const { getByText } = renderAvatar({
      name: "Time Comercial",
      pictureUrl: "https://cdn.test/grupo.jpg",
      entryType: "unofficial_whatsapp",
      isGroup: true,
    });
    expect(getByText(GROUP_LABEL)).toBeTruthy();
  });

  it("marks a group with no photo", () => {
    const { getByText } = renderAvatar({ name: "Time Comercial", isGroup: true });
    expect(getByText(GROUP_LABEL)).toBeTruthy();
  });

  it("leaves a person unmarked", () => {
    const { queryByText } = renderAvatar({
      name: "Ana",
      entryType: "unofficial_whatsapp",
    });
    expect(queryByText(GROUP_LABEL)).toBeNull();
  });

  it("states the group in text, not only as a glyph", () => {
    const { getByText } = renderAvatar({ name: "Time Comercial", isGroup: true });
    expect(getByText(GROUP_LABEL).className).toContain("sr-only");
  });

  it("localizes the label rather than hardcoding Portuguese", () => {
    const { getByText } = render(
      <NextIntlClientProvider
        locale="en"
        messages={{ common: { groupConversation: "Group" } }}
      >
        <ChannelAvatar name="Sales Team" isGroup />
      </NextIntlClientProvider>,
    );
    expect(getByText("Group")).toBeTruthy();
  });

  it("puts the group badge and the channel mark on opposite corners", () => {
    const { container } = renderAvatar({
      name: "Time Comercial",
      entryType: "unofficial_whatsapp",
      isGroup: true,
    });

    const badges = Array.from(container.querySelectorAll("span.absolute"));
    expect(badges).toHaveLength(2);

    const corners = badges.map((b) => (b.className.includes("-left-0.5") ? "left" : "right"));
    expect(new Set(corners).size).toBe(2);
    for (const badge of badges) {
      expect(badge.className).toContain("-bottom-2");
    }
  });

  it("still shows the group's initial in the circle", () => {
    const { getByText } = renderAvatar({ name: "Time Comercial", isGroup: true });
    expect(getByText("T")).toBeTruthy();
  });
});
