"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { toast } from "sonner";

import { joinWorkspaceGroupAction, previewGroupInviteAction } from "@/app/actions/unofficial-whatsapp-groups";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { CircleNotch, LinkSimple, SignIn } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useRouter } from "@/i18n/routing";
import { groupErrorKey } from "@/lib/unofficial-whatsapp-groups/group-errors";
import { defaultJoinNumbers, joinSchedule } from "@/lib/unofficial-whatsapp-groups/join-plan";
import { JOIN_SPACING_MINUTES, type InvitePreview, type JoinResult } from "@/lib/unofficial-whatsapp-groups/types";

import { OriginChip } from "./kit/identity";
import { groupsRoutes } from "./kit/routes";
import { GroupAvatar } from "./marks";
import { NumberPicker, NumberPickerSkeleton } from "./number-picker";
import { numberLabel, useWorkspaceNumbers } from "./use-workspace-numbers";

const PREVIEW_DEBOUNCE_MS = 400;

interface JoinGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanned?: (result: JoinResult | null) => void;
}

export function JoinGroupSheet({ open, onOpenChange, onPlanned }: JoinGroupSheetProps) {
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-[560px]">
        {open ? <JoinGroupForm onClose={() => onOpenChange(false)} onPlanned={onPlanned} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; preview: InvitePreview }
  | { kind: "failed"; message: string };

interface CheckedInvite {
  link: string;
  state: Extract<PreviewState, { kind: "ready" | "failed" }>;
}

function JoinGroupForm({ onClose, onPlanned }: { onClose: () => void; onPlanned?: (result: JoinResult | null) => void }) {
  const t = useTranslations("unofficialGroups.join");
  const tErrors = useTranslations("unofficialGroups.list.errors");
  const tOrigin = useTranslations("unofficialGroups.kit.origin");
  const format = useFormatter();
  const router = useRouter();
  const { numbers, loading: numbersLoading, error: numbersError } = useWorkspaceNumbers();

  const [link, setLink] = useState("");
  const [checked, setChecked] = useState<CheckedInvite | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [follow, setFollow] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();
  const previewRun = useRef(0);

  const now = useNow({ updateInterval: 30_000 });

  const text = link.trim();

  useEffect(() => {
    const run = ++previewRun.current;
    if (!text) return;
    const timer = setTimeout(() => {
      void previewGroupInviteAction(text).then((result) => {
        if (run !== previewRun.current) return;
        setChecked(
          result.error || !result.data
            ? { link: text, state: { kind: "failed", message: result.error ?? "" } }
            : { link: text, state: { kind: "ready", preview: result.data } },
        );
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const previewState: PreviewState = !text ? { kind: "idle" } : checked?.link === text ? checked.state : { kind: "loading" };
  const preview = previewState.kind === "ready" ? previewState.preview : null;
  const alreadyIn = useMemo(() => preview?.alreadyIn ?? [], [preview]);

  const selected = useMemo(() => {
    const chosen = picked ?? defaultJoinNumbers(numbers, alreadyIn);
    const inside = new Set(alreadyIn);
    const allowed = new Set(numbers.filter((number) => number.sessionLive && !inside.has(number.id)).map((number) => number.id));
    return numbers.map((number) => number.id).filter((id) => chosen.includes(id) && allowed.has(id));
  }, [picked, numbers, alreadyIn]);

  const schedule = useMemo(() => joinSchedule(selected, now, JOIN_SPACING_MINUTES), [selected, now]);
  const labels = useMemo(() => new Map(numbers.map((number) => [number.id, numberLabel(number)])), [numbers]);

  const options = useMemo(
    () =>
      numbers.map((number) => {
        const inside = alreadyIn.includes(number.id);
        return {
          number,
          disabled: inside || !number.sessionLive,
          note: inside ? t("alreadyIn") : number.sessionLive ? undefined : t("offline"),
        };
      }),
    [numbers, alreadyIn, t],
  );

  const toggle = (id: string) => {
    setPicked(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const describe = (message: string, fallback: string) => {
    const key = groupErrorKey(message);
    return key ? tErrors(key) : fallback;
  };

  const submit = () => {
    if (!preview || selected.length === 0) return;
    setSubmitError(null);
    startSubmitting(async () => {
      const result = await joinWorkspaceGroupAction({ inviteLink: preview.inviteLink, instanceIds: selected, follow });
      if (result.error || !result.data) {
        const message = describe(result.error ?? "", tErrors("joinFailed"));
        setSubmitError(message);
        toast.error(t("failed"), { description: message });
        onPlanned?.(null);
        return;
      }
      const joined = result.data;
      const group = joined.group;
      const subject = group?.subject ?? preview.subject;
      const firstJoined = joined.tasks[0]?.status === "done";
      toast(t("planned"), {
        description: !firstJoined
          ? t("queued", { subject })
          : joined.tasks.length > 1
            ? t("plannedMany", { subject, later: joined.tasks.length - 1, minutes: JOIN_SPACING_MINUTES })
            : t("plannedOne", { subject }),
        ...(group && firstJoined
          ? {
              action: { label: t("openGroup"), onClick: () => router.push(groupsRoutes.group(group.id)) },
              cancel: { label: t("setCategory"), onClick: () => router.push(groupsRoutes.group(group.id, { tab: "settings" })) },
            }
          : {}),
      });
      onPlanned?.(joined);
      onClose();
    });
  };

  const noNumbers = !numbersLoading && numbers.length === 0;

  return (
    <>
      <ElevatedSheetHeader>
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
            <SignIn className="h-5 w-5" weight="bold" />
          </span>
          <div className="min-w-0">
            <ElevatedSheetTitle>{t("title")}</ElevatedSheetTitle>
            <ElevatedSheetDescription>{t("subtitle")}</ElevatedSheetDescription>
          </div>
        </div>
      </ElevatedSheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <div className="space-y-1.5">
          <ElevatedInput
            label={t("link")}
            placeholder=" "
            value={link}
            onChange={(event) => setLink(event.target.value)}
            icon={<LinkSimple className="h-4 w-4" weight="bold" />}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">{t("linkHint")}</p>
        </div>

        {previewState.kind === "loading" ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
            {t("previewing")}
          </p>
        ) : null}

        {previewState.kind === "failed" ? (
          <Notice tone="fault" title={t("previewFailed")}>
            {describe(previewState.message, tErrors("inviteUnreadable"))}
          </Notice>
        ) : null}

        {preview ? (
          <div className="space-y-3 rounded-[--radius] border border-border p-4">
            <div className="flex items-start gap-3">
              <GroupAvatar group={{ subject: preview.subject }} size="lg" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-display text-base font-semibold text-foreground">{preview.subject}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="readout text-xs text-muted-foreground">{t("members", { count: preview.members })}</span>
                  {preview.announce ? <StatusChip tone="outline" label={t("adminsOnly")} /> : null}
                </div>
              </div>
            </div>
            {preview.description ? <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{preview.description}</p> : null}
            {alreadyIn.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("alreadyInList", { names: alreadyIn.map((id) => labels.get(id) ?? id).join(", ") })}
              </p>
            ) : null}
            {preview.announce ? <Notice tone="info">{t("adminsOnlyHint")}</Notice> : null}
            <div className="flex flex-wrap items-start gap-2 border-t border-border pt-3">
              <OriginChip origin="external" />
              <p className="min-w-0 flex-1 text-2xs text-muted-foreground">
                {t("externalNote")} {tOrigin("externalHint")}
              </p>
            </div>
          </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t("numbers")}</legend>
          {numbersError ? <Notice tone="fault">{numbersError}</Notice> : null}
          {noNumbers && !numbersError ? <Notice tone="warning">{t("noNumbers")}</Notice> : null}
          {numbersLoading ? <NumberPickerSkeleton /> : <NumberPicker label={t("numbers")} options={options} selected={selected} onToggle={toggle} />}
        </fieldset>

        {schedule.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t("scheduleTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("scheduleHint", { minutes: JOIN_SPACING_MINUTES })}</p>
            <ol className="divide-y divide-border rounded-[--radius] border border-border">
              {schedule.map((slot, index) => (
                <li key={slot.instanceId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="readout w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                    <span className="truncate text-sm text-foreground">{labels.get(slot.instanceId)}</span>
                  </span>
                  <span className="readout shrink-0 text-xs text-muted-foreground">
                    {index === 0 ? t("now") : t("at", { time: format.dateTime(slot.at, { timeStyle: "short" }) })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <ElevatedSwitch checked={follow} onCheckedChange={setFollow} label={t("follow")} description={t("followHint")} />

        {submitError ? <Notice tone="fault" title={t("failed")}>{submitError}</Notice> : null}
      </div>

      <ElevatedSheetFooter className="flex-row justify-end border-t border-border">
        <Button variant="secondary" title={t("cancel")} onClick={onClose} />
        <Button
          variant="primary"
          title={selected.length > 1 ? t("submitMany", { count: selected.length }) : t("submit")}
          disabled={!preview || selected.length === 0 || submitting}
          onClick={submit}
          icon={submitting ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : undefined}
          iconVisible={submitting}
        />
      </ElevatedSheetFooter>
    </>
  );
}
