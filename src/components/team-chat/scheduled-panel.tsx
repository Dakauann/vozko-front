"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { X } from "@/components/icons";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { TeamChatScheduled } from "@/lib/team-chat/types";

export function ScheduledPanel({
  scheduled,
  onCancel,
}: {
  scheduled: TeamChatScheduled[];
  onCancel: (scheduled: TeamChatScheduled) => Promise<{ code?: string } | null>;
}) {
  const t = useTranslations("teamChat");
  const format = useFormatter();
  if (scheduled.length === 0) {
    return <p className="border-t border-border px-4 py-3 text-2xs text-muted-foreground">{t("scheduled.empty")}</p>;
  }
  return (
    <section aria-label={t("scheduled.title")} className="max-h-48 overflow-y-auto border-t border-border">
      <p className="legend px-4 pb-1 pt-2">{t("scheduled.title")}</p>
      <ul className="divide-y divide-border">
        {scheduled.map((item) => (
          <li key={item.id} className="flex items-start gap-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-semibold tabular-nums text-foreground">
                {format.dateTime(new Date(item.send_at), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
            </div>
            <button
              type="button"
              aria-label={t("scheduled.cancel")}
              title={t("scheduled.cancel")}
              onClick={() =>
                void onCancel(item).then((error) => {
                  if (error) toast.error(codedErrorMessage(t, error, t("scheduled.cancelFailed")));
                })
              }
              className="rounded p-1 text-muted-foreground hover:bg-accent-hover hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
