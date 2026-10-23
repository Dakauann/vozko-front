import { describe, expect, it } from "vitest";

import { render } from "@testing-library/react";

import { ChannelLogo, EmailLogoColor, MercadoLivreLogoColor, RcsLogoColor, SmsLogoColor, hasChannelMark } from "./channel-logos";
import { TiktokLogoColor } from "@/components/tiktok/tiktok-logo";
import { FILTERABLE_MESSAGE_CHANNELS } from "@/lib/conversations/types";

describe("channel marks", () => {
  it("renders a mark for exactly the channels it claims to", () => {
    for (const channel of ["whatsapp", "unofficial_whatsapp", "instagram", "facebook", "telegram", "webchat", "mercadolivre", "tiktok", "email", "rcs", "sms"]) {
      expect(hasChannelMark(channel), `${channel} should claim a mark`).toBe(true);
      expect(ChannelLogo({ channel }), `${channel} should render one`).not.toBeNull();
    }
  });

  it("claims no mark for channels it cannot draw", () => {
    expect(hasChannelMark("fax")).toBe(false);
    expect(ChannelLogo({ channel: "fax" })).toBeNull();
    expect(hasChannelMark(null)).toBe(false);
    expect(hasChannelMark(undefined)).toBe(false);
  });

  it("covers every filterable channel except voice", () => {
    for (const channel of FILTERABLE_MESSAGE_CHANNELS) {
      expect(hasChannelMark(channel), `${channel} is filterable but has no mark`).toBe(true);
    }
  });

  it("distinguishes the two WhatsApp transports", () => {
    const official = ChannelLogo({ channel: "whatsapp" }) as { type: unknown };
    const unofficial = ChannelLogo({ channel: "unofficial_whatsapp" }) as { type: unknown };
    expect(official.type).not.toBe(unofficial.type);
  });

  it("draws Mercado Livre as a solid yellow mark with navy ink", () => {
    const { container } = render(<MercadoLivreLogoColor />);
    const fills = Array.from(container.querySelectorAll("[fill]")).map((node) => node.getAttribute("fill"));
    const strokes = Array.from(container.querySelectorAll("[stroke]")).map((node) => node.getAttribute("stroke"));
    expect(fills).toContain("#FFE600");
    expect(strokes).toContain("#2D3277");
    expect((ChannelLogo({ channel: "mercadolivre" }) as { type: unknown }).type).toBe(MercadoLivreLogoColor);
  });

  it("draws TikTok with its own mark", () => {
    expect((ChannelLogo({ channel: "tiktok" }) as { type: unknown }).type).toBe(TiktokLogoColor);
  });

  it("draws email like the other in-house marks: an indigo plate with a solid white envelope drawn inline", () => {
    const { container } = render(<EmailLogoColor />);
    const fills = Array.from(container.querySelectorAll("[fill]")).map((node) => node.getAttribute("fill"));
    expect(fills).toContain("#4F46E5");
    expect(fills).toContain("#FFFFFF");
    expect(container.querySelectorAll("svg svg")).toHaveLength(0);
    expect((ChannelLogo({ channel: "email" }) as { type: unknown }).type).toBe(EmailLogoColor);
  });

  it("draws RCS and SMS as their own marks", () => {
    expect((ChannelLogo({ channel: "rcs" }) as { type: unknown }).type).toBe(RcsLogoColor);
    expect((ChannelLogo({ channel: "sms" }) as { type: unknown }).type).toBe(SmsLogoColor);
  });
});
