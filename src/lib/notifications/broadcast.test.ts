import { describe, expect, it } from "vitest";

import {
  BROADCAST_FORM_DEFAULTS,
  BROADCAST_RECIPIENT_STATUSES,
  actionLinkKind,
  broadcastReachKey,
  broadcastReadShare,
  broadcastPreviewItem,
  broadcastProblems,
  broadcastRequest,
  imageFileProblem,
  isBroadcast,
  isBroadcastPage,
  isBroadcastReach,
  isBroadcastRecipientPage,
  usersAudienceAvailable,
  type BroadcastForm,
} from "./broadcast";

const form: BroadcastForm = {
  ...BROADCAST_FORM_DEFAULTS,
  allWorkspaces: true,
  title: "  Nova versão  ",
  body: "  Chegou o painel novo.  ",
};

describe("actionLinkKind", () => {
  it("routes relative paths inside the app", () => {
    expect(actionLinkKind("/dashboard/whatsapp-campaigns")).toBe("internal");
  });

  it("opens https links outside", () => {
    expect(actionLinkKind("https://status.example.com/incident")).toBe("external");
  });

  it("refuses everything the backend refuses", () => {
    for (const link of ["", "//evil.com", "http://plain.com", "https://", "https:///x", "javascript:alert(1)", "/a b", "/a\\b", "dashboard"]) {
      expect(actionLinkKind(link), link).toBeNull();
    }
  });
});

describe("imageFileProblem", () => {
  it("accepts the four image types up to 5 MB", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(imageFileProblem({ type, size: 5 * 1024 * 1024 })).toBeNull();
    }
  });

  it("names the problem with the backend code", () => {
    expect(imageFileProblem({ type: "image/png", size: 0 })).toBe("notification_image_empty");
    expect(imageFileProblem({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toBe("notification_image_too_large");
    expect(imageFileProblem({ type: "image/svg+xml", size: 10 })).toBe("notification_image_type");
  });
});

describe("usersAudienceAvailable", () => {
  it("needs exactly one picked workspace", () => {
    expect(usersAudienceAvailable({ allWorkspaces: true, workspaceIds: [] })).toBe(false);
    expect(usersAudienceAvailable({ allWorkspaces: false, workspaceIds: ["w1"] })).toBe(true);
    expect(usersAudienceAvailable({ allWorkspaces: false, workspaceIds: ["w1", "w2"] })).toBe(false);
  });
});

describe("broadcastProblems", () => {
  it("passes a complete form", () => {
    expect(broadcastProblems(form)).toEqual([]);
  });

  it("asks for a target and a title", () => {
    expect(broadcastProblems({ ...form, allWorkspaces: false, title: "   " })).toEqual([
      "notification_target_invalid",
      "notification_title_required",
    ]);
  });

  it("counts characters the way the backend counts runes", () => {
    expect(broadcastProblems({ ...form, title: "é".repeat(120) })).toEqual([]);
    expect(broadcastProblems({ ...form, title: "😀".repeat(121) })).toEqual(["notification_title_too_long"]);
    expect(broadcastProblems({ ...form, body: "a".repeat(2001) })).toEqual(["notification_body_too_long"]);
    expect(broadcastProblems({ ...form, actionUrl: "/x", actionLabel: "a".repeat(41) })).toEqual(["notification_action_label_too_long"]);
  });

  it("refuses a bad link and a label without a link", () => {
    expect(broadcastProblems({ ...form, actionUrl: "ftp://x" })).toEqual(["notification_action_url_invalid"]);
    expect(broadcastProblems({ ...form, actionLabel: "Abrir" })).toEqual(["notification_action_url_invalid"]);
  });

  it("needs picked users when the audience is a user list", () => {
    const single = { ...form, allWorkspaces: false, workspaceIds: ["w1"], audience: "users" as const };

    expect(broadcastProblems(single)).toEqual(["notification_audience_invalid"]);
    expect(broadcastProblems({ ...single, userIds: ["u1"] })).toEqual([]);
    expect(broadcastProblems({ ...single, workspaceIds: ["w1", "w2"], userIds: ["u1"] })).toEqual(["notification_audience_invalid"]);
  });
});

describe("broadcastRequest", () => {
  it("sends every workspace with trimmed content and no empty optionals", () => {
    expect(broadcastRequest(form)).toEqual({
      target: { all: true, workspaceIds: [] },
      audience: { kind: "everyone" },
      category: "announcements",
      severity: "info",
      title: "Nova versão",
      body: "Chegou o painel novo.",
      email: false,
    });
  });

  it("sends picked workspaces, the user list, the link and the image", () => {
    const request = broadcastRequest({
      ...form,
      allWorkspaces: false,
      workspaceIds: ["w1"],
      audience: "users",
      userIds: ["u1", "u2"],
      category: "billing",
      severity: "critical",
      imageUrl: "https://cdn/x.png",
      actionUrl: " /dashboard/invoices ",
      actionLabel: " Ver faturas ",
      email: true,
    });

    expect(request).toEqual({
      target: { all: false, workspaceIds: ["w1"] },
      audience: { kind: "users", userIds: ["u1", "u2"] },
      category: "billing",
      severity: "critical",
      title: "Nova versão",
      body: "Chegou o painel novo.",
      imageUrl: "https://cdn/x.png",
      actionUrl: "/dashboard/invoices",
      actionLabel: "Ver faturas",
      email: true,
    });
  });

  it("drops the user list for managers", () => {
    expect(broadcastRequest({ ...form, audience: "managers", userIds: ["u1"] }).audience).toEqual({ kind: "managers" });
  });
});

describe("broadcastPreviewItem", () => {
  it("renders the form as an unread item", () => {
    const item = broadcastPreviewItem({ ...form, actionUrl: "/x", actionLabel: "Ir" }, "2026-10-16T12:00:00Z");

    expect(item).toEqual({
      id: "preview",
      category: "announcements",
      severity: "info",
      title: "Nova versão",
      body: "Chegou o painel novo.",
      actionUrl: "/x",
      actionLabel: "Ir",
      createdAt: "2026-10-16T12:00:00Z",
    });
  });
});

describe("broadcast guards", () => {
  const broadcast = {
    id: "b1",
    target: { all: false, workspaceIds: ["w1"] },
    audience: { kind: "managers" },
    category: "announcements",
    severity: "info",
    title: "Oi",
    body: "",
    email: true,
    status: "queued",
    workspaceCount: 1,
    createdAt: "2026-10-16T12:00:00Z",
  };

  it("accepts a broadcast and a page of them", () => {
    expect(isBroadcast(broadcast)).toBe(true);
    expect(isBroadcast({ ...broadcast, target: { all: true } })).toBe(true);
    expect(isBroadcastPage({ items: [broadcast], next: "" })).toBe(true);
  });

  it("refuses a broadcast without its target or audience", () => {
    expect(isBroadcast({ ...broadcast, target: undefined })).toBe(false);
    expect(isBroadcast({ ...broadcast, audience: { kind: 3 } })).toBe(false);
    expect(isBroadcastPage({ items: [{ ...broadcast, id: undefined }], next: "" })).toBe(false);
  });
});

describe("broadcast reach and read status", () => {
  const broadcast = {
    id: "b1",
    target: { all: true },
    audience: { kind: "everyone" },
    category: "announcements",
    severity: "info",
    title: "Oi",
    createdAt: "2026-10-16T12:00:00Z",
  };

  it("accepts recipient and read counts on a broadcast and refuses them as text", () => {
    expect(isBroadcast({ ...broadcast, recipients: 40, read: 10 })).toBe(true);
    expect(isBroadcast({ ...broadcast, recipients: "40" })).toBe(false);
    expect(isBroadcast({ ...broadcast, read: "10" })).toBe(false);
  });

  it("reads the share that read it, only when someone received it", () => {
    expect(broadcastReadShare({ recipients: 40, read: 10 })).toBe(0.25);
    expect(broadcastReadShare({ recipients: 40 })).toBe(0);
    expect(broadcastReadShare({ recipients: 0, read: 0 })).toBeNull();
    expect(broadcastReadShare({})).toBeNull();
  });

  it("keys the reach on what decides who receives it, never on the content", () => {
    const request = broadcastRequest(form);
    const key = broadcastReachKey(request);

    expect(broadcastReachKey({ ...request, title: "Outro", body: "Outro texto", imageUrl: "https://cdn/x.png" })).toBe(key);
    expect(broadcastReachKey({ ...request, category: "billing" })).not.toBe(key);
    expect(broadcastReachKey({ ...request, severity: "critical" })).not.toBe(key);
    expect(broadcastReachKey({ ...request, email: true })).not.toBe(key);
    expect(broadcastReachKey({ ...request, target: { all: false, workspaceIds: ["w1"] } })).not.toBe(key);
    expect(broadcastReachKey({ ...request, audience: { kind: "managers" } })).not.toBe(key);
  });

  it("recognises the reach answer", () => {
    expect(isBroadcastReach({ workspaces: 2, recipients: 30, people: 28, emails: 20 })).toBe(true);
    expect(isBroadcastReach({ workspaces: 2, recipients: 30, people: 28 })).toBe(false);
    expect(isBroadcastReach({ workspaces: "2", recipients: 30, people: 28, emails: 20 })).toBe(false);
  });

  it("recognises a page of recipients with and without a read time", () => {
    const read = { userId: "u1", name: "Ana", email: "ana@example.com", workspaceId: "w1", workspaceName: "Loja", readAt: "2026-10-16T13:00:00Z" };
    const unread = { userId: "u2", name: "", email: "bia@example.com", workspaceId: "w1", workspaceName: "Loja" };

    expect(isBroadcastRecipientPage({ items: [read, unread, { ...unread, readAt: null }], next: "c2" })).toBe(true);
    expect(isBroadcastRecipientPage({ items: [] })).toBe(true);
    expect(isBroadcastRecipientPage({ items: [{ ...read, workspaceName: undefined }], next: "" })).toBe(false);
    expect(isBroadcastRecipientPage({ items: [{ ...read, readAt: 5 }], next: "" })).toBe(false);
  });

  it("filters recipients by all, read and unread", () => {
    expect(BROADCAST_RECIPIENT_STATUSES).toEqual(["all", "read", "unread"]);
  });
});
