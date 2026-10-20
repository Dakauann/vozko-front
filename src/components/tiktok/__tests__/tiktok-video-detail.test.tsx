import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import type { CommentManageBlock } from "@/lib/tiktok/account";
import { tiktokAccount, tiktokComment, tiktokVideo } from "@/lib/tiktok/test-fixtures";
import type { TiktokAccount } from "@/lib/tiktok/types";

const mocks = vi.hoisted(() => ({
  listComments: vi.fn(),
  setHidden: vi.fn(),
  setLiked: vi.fn(),
  reply: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@/app/actions/tiktok", () => ({
  listTiktokCommentsAction: mocks.listComments,
  setTiktokCommentHiddenAction: mocks.setHidden,
  setTiktokCommentLikedAction: mocks.setLiked,
  replyTiktokCommentAction: mocks.reply,
  listTiktokCommentRulesAction: vi.fn(async () => ({ rules: [] })),
  createTiktokCommentRuleAction: vi.fn(),
  updateTiktokCommentRuleAction: vi.fn(),
  deleteTiktokCommentRuleAction: vi.fn(),
  listTiktokAccountsAction: vi.fn(),
  listTiktokVideosAction: vi.fn(),
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: mocks.can }) }));
vi.mock("@/components/audience/post", () => ({ CommentPostAnalysisPanel: () => <div data-testid="analysis" /> }));

import { TiktokVideoDetail } from "@/components/tiktok/tiktok-video-detail";

const messages = { ...brandedMessages(rawPt), tiktok: {} };

function renderDetail(account: TiktokAccount, block: CommentManageBlock | null) {
  return render(
    <NextIntlClientProvider
      locale="pt"
      messages={messages}
      timeZone="America/Sao_Paulo"
      onError={() => undefined}
      getMessageFallback={({ namespace, key }) => `${namespace}.${key}`}
    >
      <TiktokVideoDetail account={account} video={tiktokVideo()} block={block} onClose={() => undefined} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.can.mockReturnValue(false);
  mocks.listComments.mockResolvedValue({ page: { comments: [tiktokComment()], hasMore: false } });
  mocks.setHidden.mockResolvedValue({ comment: tiktokComment({ visibility: "hidden" }) });
});

describe("TiktokVideoDetail comments", () => {
  it("offers reply, hide and like to a member who can moderate, and asks for hidden comments", async () => {
    renderDetail(tiktokAccount(), null);
    expect(await screen.findByText("tiktok.comments.reply")).toBeTruthy();
    expect(screen.getByRole("button", { name: "tiktok.comments.hide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "tiktok.comments.like" })).toBeTruthy();
    expect(mocks.listComments).toHaveBeenCalledWith("acc-1", "v-1", undefined, true);
  });

  it("never offers a private reply or a delete", async () => {
    renderDetail(tiktokAccount(), null);
    await screen.findByText("tiktok.comments.reply");
    expect(screen.queryByText("tiktok.comments.privateReply")).toBeNull();
    expect(screen.queryByRole("button", { name: "tiktok.comments.delete" })).toBeNull();
  });

  it("hides a comment through the TikTok endpoint and reloads the thread", async () => {
    renderDetail(tiktokAccount(), null);
    fireEvent.click(await screen.findByRole("button", { name: "tiktok.comments.hide" }));
    await waitFor(() => expect(mocks.setHidden).toHaveBeenCalledWith("acc-1", "c-1", true));
    await waitFor(() => expect(mocks.listComments).toHaveBeenCalledTimes(2));
  });

  it("shows comments read only, without hidden ones, when the member cannot moderate", async () => {
    renderDetail(tiktokAccount(), "permission");
    expect(await screen.findByText("quanto custa?")).toBeTruthy();
    expect(screen.getByText("tiktok.commentRules.blocked.permission")).toBeTruthy();
    expect(screen.queryByText("tiktok.comments.reply")).toBeNull();
    expect(screen.queryByRole("button", { name: "tiktok.comments.hide" })).toBeNull();
    expect(screen.queryByRole("button", { name: "tiktok.comments.like" })).toBeNull();
    expect(mocks.listComments).toHaveBeenCalledWith("acc-1", "v-1", undefined, false);
  });

  it("does not ask TikTok for comments the account cannot read", () => {
    const account = tiktokAccount({ capabilities: { ...tiktokAccount().capabilities, canReadComments: false } });
    renderDetail(account, "capability");
    expect(screen.getByText("tiktok.comments.unreadable")).toBeTruthy();
    expect(mocks.listComments).not.toHaveBeenCalled();
  });

  it("shows the analysis tab only to members who can read the audience", async () => {
    renderDetail(tiktokAccount(), null);
    await screen.findByText("tiktok.comments.reply");
    expect(screen.queryByRole("tab", { name: "tiktok.videos.tabAnalysis" })).toBeNull();
  });
});
