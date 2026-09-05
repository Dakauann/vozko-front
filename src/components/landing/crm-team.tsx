import { LockKey, Sparkle } from "@/components/icons";
import type { CrmSceneLabels } from "./scenes/crm-console";
import styles from "./landing.module.css";

export function CrmTeam({ labels }: { labels: CrmSceneLabels["team"] }) {
  return (
    <div className={styles.crmTeam}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{labels.title}</p>
        <span className="flex items-center gap-1.5 text-[11px] text-primary-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          {labels.status}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {labels.members.map((member) => (
          <li key={member.name} className="flex min-w-0 items-center gap-2.5 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-semibold text-foreground" aria-hidden="true">
              {member.kind === "ai" ? <Sparkle size={14} /> : member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground">{member.name}</span>
              <span className="block text-[11px] leading-4 text-muted-foreground">{member.inbox}</span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{member.kind === "ai" ? labels.ai : labels.human}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <LockKey size={13} className="mt-1 shrink-0 text-foreground" aria-hidden="true" />
        {labels.privacy}
      </p>
    </div>
  );
}
