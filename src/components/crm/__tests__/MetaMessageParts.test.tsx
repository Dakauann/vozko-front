import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import {
    LikeSticker,
    PostbackChip,
    ReactionChip,
    ReferralChip,
    SentViaBadge,
    SharedLinkCard,
    StoryCard,
    UnsupportedNotice,
} from "../MetaMessageParts";

const meta = ptMessages.crmConversation.meta;

function renderPt(node: React.ReactNode) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            {node}
        </NextIntlClientProvider>,
    );
}

describe("Meta message renderers", () => {
    it("draws the like sticker as a thumbs up", () => {
        renderPt(<LikeSticker />);
        expect(screen.getByRole("img", { name: meta.likeSticker }).textContent).toBe("👍");
    });

    it("links a shared link card and falls back to a label without a title", () => {
        renderPt(<SharedLinkCard kind="link" url="https://x.test/a" />);
        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe("https://x.test/a");
        expect(screen.getByText(meta.sharedLink)).toBeInTheDocument();
    });

    it("renders a shared post with its title and no link when Meta sent no URL", () => {
        renderPt(<SharedLinkCard kind="post" title="Promo" />);
        expect(screen.getByText("Promo")).toBeInTheDocument();
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("shows the reaction emoji on the bubble", () => {
        renderPt(<ReactionChip emoji="😍" />);
        expect(screen.getByLabelText("Reação 😍").textContent).toBe("😍");
    });

    it("names the ad a conversation came from", () => {
        renderPt(<ReferralChip referral={{ source: "ADS", adTitle: "Promo de outubro" }} />);
        expect(screen.getByText("Veio do anúncio: Promo de outubro")).toBeInTheDocument();
    });

    it("falls back to the referral source without an ad title", () => {
        renderPt(<ReferralChip referral={{ source: "SHORTLINK" }} />);
        expect(screen.getByText("Veio de SHORTLINK")).toBeInTheDocument();
    });

    it("labels the tapped button", () => {
        renderPt(<PostbackChip title="Começar" />);
        expect(screen.getByText("Tocou no botão Começar")).toBeInTheDocument();
    });

    it("badges echoes sent outside Vozko and nothing for Vozko's own", () => {
        const { container } = renderPt(<SentViaBadge via="vozko" />);
        expect(container.textContent).toBe("");
        renderPt(<SentViaBadge via="meta_business_suite" />);
        expect(screen.getByText(meta.sentVia.meta_business_suite)).toBeInTheDocument();
    });

    it("labels story replies and mentions through the catalog", () => {
        renderPt(<StoryCard prefix="facebook" mention={false} text="Amei" />);
        expect(screen.getByText(meta.storyReply)).toBeInTheDocument();
        expect(screen.getByText("Amei")).toBeInTheDocument();
    });

    it("says a message is unsupported when Meta sent no text", () => {
        renderPt(<UnsupportedNotice />);
        expect(screen.getByText(meta.unsupported)).toBeInTheDocument();
    });
});
