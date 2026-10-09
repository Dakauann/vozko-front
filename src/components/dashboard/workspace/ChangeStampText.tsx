"use client";

import type { ReactNode } from "react";
import { useFormatter } from "next-intl";

import { EmptyValue } from "@/components/elevated-design/empty-value";
import type { ChangeStamp } from "@/lib/workspace/workspace-config/change-stamp";

export type ChangeStampValues = {
  date: string;
  person: string;
  name: (chunks: ReactNode) => ReactNode;
};

export function ChangeStampText({
  stamp,
  message,
  never,
}: {
  stamp: ChangeStamp | null;
  message: (values: ChangeStampValues) => ReactNode;
  never?: string;
}) {
  const format = useFormatter();
  if (!stamp) return never ? <p className="text-2xs text-muted-foreground">{never}</p> : null;
  const by = stamp.by;
  return (
    <p className="text-2xs text-muted-foreground">
      {message({
        date: format.dateTime(new Date(stamp.at), { dateStyle: "short", timeStyle: "short" }),
        name: (chunks) => (by ? <span className="font-medium text-foreground">{chunks}</span> : <EmptyValue />),
        person: by ?? "",
      })}
    </p>
  );
}
