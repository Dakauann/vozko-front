"use client";

import {
  ArrowClockwise,
  Check,
  Crown,
  LinkSimple,
  PencilSimple,
  SignOut,
  UserMinus,
  UsersThree,
} from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getConversationGroupAction,
  getConversationGroupInviteLinkAction,
  leaveConversationGroupAction,
  updateConversationGroupAction,
  updateConversationGroupParticipantsAction,
} from "@/app/actions/unofficial-whatsapp";
import {
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  type GroupParticipant,
  type UnofficialWhatsAppGroup,
} from "@/lib/unofficial-whatsapp/types";
import { cn } from "@/lib/utils";

/**
 * The group tab of the conversation context rail.
 *
 * It only ever appears for a group conversation, so nothing here has to reason
 * about a person: the panel's other tabs answer "who is this contact", and this
 * one answers the questions only a group raises — who is in it, who runs it, and
 * whether we may post.
 *
 * Two rules shape the whole component:
 *
 *  1. **Every admin control is gated on `weAreAdmin`.** That flag is the
 *     PROVIDER's answer about our connected number, computed server-side. A
 *     button we render without it is a button that is certain to fail, and
 *     learning "you are not an admin" from a red toast after the click is a
 *     worse experience than a control that was never offered.
 *  2. **Reads do not poll.** The server keeps a cached copy with its own
 *     staleness clock; mounting asks for it, and only the refresh button forces
 *     a live read. A panel that re-read on every render would spend the
 *     customer's own WhatsApp number's API budget on a screen whose content
 *     changes weekly — and traffic that looks automated is what gets an
 *     unofficial number banned.
 */

/**
 * How many roster rows to render at a time.
 *
 * Sized to the common case: most groups have fewer members than this and never
 * show the "show more" control, while a 1024-member group renders twenty rows
 * instead of a thousand.
 */
const MEMBER_PAGE_SIZE = 20;

interface ConversationGroupSectionProps {
  entryId: string;
  /** Whether the panel is on screen. Nothing is fetched while it is not. */
  active: boolean;
  /** Refreshes the surrounding conversation after a rename lands. */
  onSubjectChange?: (subject: string) => void;
}

/**
 * One fetch, one state.
 *
 * A separate `loading` boolean beside `group` and `error` can represent
 * "loading AND already failed", which is not a state this panel has. Collapsing
 * them means the render below reads as three exclusive cases and cannot get
 * them out of step.
 */
type GroupState =
  | { status: "loading" }
  | { status: "ready"; group: UnofficialWhatsAppGroup }
  | { status: "error"; message: string };

export default function ConversationGroupSection({
  entryId,
  active,
  onSubjectChange,
}: ConversationGroupSectionProps) {
  const t = useTranslations("crmGroupPanel");

  const [state, setState] = useState<GroupState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  // `editing` holds the drafts rather than a separate pair of state slots.
  //
  // Seeding drafts from the loaded group through an effect would resync them
  // under an operator mid-edit every time a background refresh landed, wiping
  // what they had typed. Opening the form snapshots the values instead, which
  // is the only moment that snapshot is meaningful.
  const [editing, setEditing] = useState<{ subject: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);

  // How many roster rows are rendered.
  //
  // The API returns the WHOLE roster deliberately — admin actions have to be
  // able to reach any member, and a paged endpoint would mean "promote someone
  // on page 7" needs a search the provider does not offer. WhatsApp caps a group
  // at 1024, so the payload is bounded and small; what is NOT bounded is the DOM,
  // and a thousand rows in a 400px rail is a scroll nobody can use and a render
  // nobody asked for.
  //
  // So: page the VIEW, not the request. Most groups are under this and never see
  // the control at all.
  const [visibleMembers, setVisibleMembers] = useState(MEMBER_PAGE_SIZE);

  const [pendingMember, setPendingMember] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const group = state.status === "ready" ? state.group : null;

  // One read, on mount, and only while visible. The `active` guard keeps a
  // closed rail from fetching a roster nobody is looking at; the caller keys
  // this component by conversation, so switching chats remounts it rather than
  // needing an effect to reset every slot above.
  useEffect(() => {
    if (!active || !entryId) return;

    let cancelled = false;
    void (async () => {
      const res = await getConversationGroupAction(entryId);
      if (cancelled) return;
      setState(
        res.error || !res.group
          ? { status: "error", message: res.error ?? "" }
          : { status: "ready", group: res.group },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [active, entryId]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const res = await getConversationGroupAction(entryId, true);
    setRefreshing(false);
    if (res.error || !res.group) {
      toast.error(t("refreshError"), { description: res.error });
      return;
    }
    setState({ status: "ready", group: res.group });
  }, [entryId, refreshing, t]);

  const handleSave = useCallback(async () => {
    if (!group || !editing || saving) return;

    // ONLY what changed. Every field is optional server-side and an absent one
    // means "leave it alone", so submitting the whole form would rewrite
    // settings the operator never touched.
    const payload: { subject?: string; description?: string } = {};
    const subject = editing.subject.trim();
    const description = editing.description.trim();
    if (subject && subject !== group.subject) payload.subject = subject;
    if (description !== (group.description ?? "")) payload.description = description;

    if (Object.keys(payload).length === 0) {
      setEditing(null);
      return;
    }

    setSaving(true);
    const res = await updateConversationGroupAction(entryId, payload);
    setSaving(false);

    if (res.error || !res.group) {
      toast.error(t("saveError"), { description: res.error });
      return;
    }
    setState({ status: "ready", group: res.group });
    setEditing(null);
    toast.success(t("saveSuccess"));
    if (payload.subject) onSubjectChange?.(payload.subject);
  }, [group, editing, saving, entryId, onSubjectChange, t]);

  const handleMemberAction = useCallback(
    async (participant: GroupParticipant, action: "promote" | "demote" | "remove") => {
      if (pendingMember) return;
      setPendingMember(participant.jid);

      const target = participant.phoneNumber || participant.jid;
      const res = await updateConversationGroupParticipantsAction(entryId, action, [target]);
      setPendingMember(null);

      if (res.error || !res.group) {
        toast.error(t(`memberError.${action}`), { description: res.error });
        return;
      }
      // The response is a FRESH read, not an echo of the request: a provider
      // acknowledgement says only that the change was accepted, and the two
      // diverge whenever it is partially applied.
      setState({ status: "ready", group: res.group });
      toast.success(t(`memberSuccess.${action}`, { name: participant.name }));
    },
    [entryId, pendingMember, t],
  );

  const handleInviteLink = useCallback(async () => {
    if (loadingInvite) return;

    // Fetched on demand and never held in the page beyond this render: the link
    // is a standing credential, and anyone who receives it can join the
    // customer's group without approval.
    setLoadingInvite(true);
    const res = await getConversationGroupInviteLinkAction(entryId);
    setLoadingInvite(false);

    if (res.error || !res.inviteLink) {
      toast.error(t("inviteError"), { description: res.error });
      return;
    }
    setInviteLink(res.inviteLink);
    try {
      await navigator.clipboard.writeText(res.inviteLink);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      /* clipboard unavailable; the link is on screen either way */
    }
  }, [entryId, loadingInvite, t]);

  const handleLeave = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    const res = await leaveConversationGroupAction(entryId);
    setLeaving(false);

    if (res.error) {
      toast.error(t("leaveError"), { description: res.error });
      return;
    }
    setConfirmingLeave(false);
    setState({ status: "error", message: t("leftGroup") });
    toast.success(t("leaveSuccess"));
  }, [entryId, leaving, t]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center px-3 py-10 text-muted-foreground">
        <ArrowClockwise weight="bold" className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <UsersThree weight="thin" className="h-10 w-10 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {(state.status === "error" && state.message) || t("unavailable")}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <ArrowClockwise
            weight="bold"
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          {t("retry")}
        </button>
      </div>
    );
  }

  const participants = group.participants ?? [];
  const shownMembers = participants.slice(0, visibleMembers);
  const hiddenMembers = participants.length - shownMembers.length;
  const canEdit = group.weAreAdmin || !group.adminsOnlyEdit;

  return (
    <div className="flex flex-col gap-4 px-3 py-4">
      {/* Identity + the two facts that decide what the rest of the CRM may do */}
      <section className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {editing ? (
              <input
                value={editing.subject}
                onChange={(e) =>
                  setEditing((d) => (d ? { ...d, subject: e.target.value } : d))
                }
                maxLength={MAX_GROUP_NAME_LENGTH}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold text-foreground outline-none focus:border-primary"
                aria-label={t("subject")}
              />
            ) : (
              <h4 className="truncate text-sm font-semibold text-foreground">
                {group.subject || t("unnamed")}
              </h4>
            )}
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {t("memberCount", { count: group.participantCount })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label={t("refresh")}
              title={t("refresh")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              <ArrowClockwise
                weight="bold"
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
            </button>
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    subject: group.subject ?? "",
                    description: group.description ?? "",
                  })
                }
                aria-label={t("edit")}
                title={t("edit")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PencilSimple weight="bold" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={editing.description}
              onChange={(e) =>
                setEditing((d) => (d ? { ...d, description: e.target.value } : d))
              }
              maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
              rows={3}
              placeholder={t("descriptionPlaceholder")}
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              aria-label={t("description")}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs tabular-nums text-muted-foreground">
                {editing.subject.length}/{MAX_GROUP_NAME_LENGTH}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !editing.subject.trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors",
                    (saving || !editing.subject.trim()) && "pointer-events-none opacity-60",
                  )}
                >
                  {saving && <ArrowClockwise weight="bold" className="h-3 w-3 animate-spin" />}
                  {t("save")}
                </button>
              </div>
            </div>
          </div>
        ) : group.description ? (
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {group.description}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {group.weAreAdmin && (
            <Badge tone="healthy" icon={<Crown weight="fill" className="h-3 w-3" />}>
              {t("youAreAdmin")}
            </Badge>
          )}
          {/* Announce-only is the state most worth surfacing: it is why the
              composer is disabled, and without saying so the input just looks
              broken. */}
          {group.adminsOnlyMessages && (
            <Badge tone={group.canPost ? "muted" : "warning"}>
              {group.canPost ? t("announceOnly") : t("cannotPost")}
            </Badge>
          )}
          {group.isCommunity && <Badge tone="muted">{t("community")}</Badge>}
          {group.ephemeral && <Badge tone="muted">{t("ephemeral")}</Badge>}
        </div>
      </section>

      {/* Invite link. Admin-only and fetched on demand — it is a credential. */}
      {group.weAreAdmin && (
        <section>
          <button
            type="button"
            onClick={handleInviteLink}
            disabled={loadingInvite}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {loadingInvite ? (
              <ArrowClockwise weight="bold" className="h-3.5 w-3.5 animate-spin" />
            ) : inviteCopied ? (
              <Check weight="bold" className="h-3.5 w-3.5 text-healthy-ink" />
            ) : (
              <LinkSimple weight="bold" className="h-3.5 w-3.5" />
            )}
            {inviteCopied ? t("inviteCopied") : t("inviteLink")}
          </button>
          {inviteLink && (
            <p className="mt-1.5 break-all rounded-md bg-muted px-2 py-1.5 text-2xs text-muted-foreground">
              {inviteLink}
            </p>
          )}
        </section>
      )}

      {/* Roster. Admins first — an operator scanning a group wants to know who
          can act, not who joined in which order. */}
      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <UsersThree weight="bold" className="h-3 w-3 text-primary-foreground" />
          </span>
          <h4 className="text-xs font-semibold text-foreground">{t("members")}</h4>
        </div>

        {participants.length === 0 ? (
          <p className="rounded-[--radius] border border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
            {t("noMembers")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {shownMembers.map((p) => (
              <li
                key={p.jid}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{p.name}</p>
                  {p.phoneNumber && p.phoneNumber !== p.name.replace("+", "") && (
                    <p className="truncate text-2xs text-muted-foreground">
                      +{p.phoneNumber}
                    </p>
                  )}
                </div>

                {p.isAdmin && (
                  <Crown
                    weight="fill"
                    className="h-3 w-3 shrink-0 text-warning-ink"
                    aria-label={t("admin")}
                  />
                )}

                {group.weAreAdmin && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconAction
                      label={p.isAdmin ? t("demote") : t("promote")}
                      busy={pendingMember === p.jid}
                      onClick={() =>
                        handleMemberAction(p, p.isAdmin ? "demote" : "promote")
                      }
                    >
                      <Crown
                        weight={p.isAdmin ? "regular" : "fill"}
                        className="h-3.5 w-3.5"
                      />
                    </IconAction>
                    <IconAction
                      label={t("remove")}
                      danger
                      busy={pendingMember === p.jid}
                      onClick={() => handleMemberAction(p, "remove")}
                    >
                      <UserMinus weight="bold" className="h-3.5 w-3.5" />
                    </IconAction>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {hiddenMembers > 0 && (
          <button
            type="button"
            onClick={() => setVisibleMembers((n) => n + MEMBER_PAGE_SIZE)}
            className="mt-1.5 w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("showMore", { count: hiddenMembers })}
          </button>
        )}
      </section>

      {/* Leaving is irreversible from our side and visible to everyone in the
          group, so it confirms. The CONVERSATION stays either way: the
          transcript is history, and leaving does not un-say what was said. */}
      <section className="border-t border-border pt-3">
        {confirmingLeave ? (
          <div className="flex flex-col gap-2">
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {t("confirmLeave")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingLeave(false)}
                disabled={leaving}
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleLeave}
                disabled={leaving}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground",
                  leaving && "pointer-events-none opacity-70",
                )}
              >
                {leaving && <ArrowClockwise weight="bold" className="h-3.5 w-3.5 animate-spin" />}
                {t("confirmLeaveAction")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingLeave(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-destructive-ink transition-colors hover:bg-muted"
          >
            <SignOut weight="bold" className="h-3.5 w-3.5" />
            {t("leave")}
          </button>
        )}
      </section>
    </div>
  );
}

/** A status chip. Tone rides the text and the border, never a same-hue fill. */
function Badge({
  tone,
  icon,
  children,
}: {
  tone: "healthy" | "warning" | "muted";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const TONES = {
    healthy: "border-border bg-card text-healthy-ink",
    warning: "border-border bg-card text-warning-ink",
    muted: "border-border bg-muted text-muted-foreground",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[--radius] border px-2 py-0.5 text-2xs font-semibold",
        TONES[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** A compact icon button with an accessible name, used for the roster actions
 *  where a text label would not fit. */
function IconAction({
  label,
  onClick,
  busy,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-50",
        danger
          ? "text-muted-foreground hover:bg-muted hover:text-destructive-ink"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
