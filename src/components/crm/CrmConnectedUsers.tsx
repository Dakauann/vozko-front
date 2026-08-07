"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Broadcast,
  CalendarBlank,
  ClockCounterClockwise,
  Person,
  Users,
  X,
} from "@/components/icons";
import { useEffect, useMemo, useState } from "react";

import Button from "../elevated-design/button";
import { ConnectedUser } from "@/lib/conversations/types";

function formatDuration(connectedAt: string, now: Date) {
  const start = new Date(connectedAt);

  if (Number.isNaN(start.getTime())) {
    return "-";
  }

  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatConnectedSince(connectedAt: string) {
  const date = new Date(connectedAt);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatUserId(userId: string) {
  if (userId.length <= 16) {
    return userId;
  }

  return `${userId.slice(0, 8)}...${userId.slice(-6)}`;
}

export default function CrmConnectedUsers({
  connectedUsers,
}: {
  connectedUsers: ConnectedUser[];
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const global = connectedUsers.filter(
      (user) => user.view_mode === "global",
    ).length;

    return {
      total: connectedUsers.length,
      global,
      campaign: connectedUsers.length - global,
    };
  }, [connectedUsers]);

  return (
    <div className="relative">
      <div
        onClick={() => setOpen((current) => !current)}
        className="cursor-pointer"
      >
        <Button
          variant="outline-subtle"
          size="sm"
          title={connectedUsers.length.toString()}
          aria-label={`${connectedUsers.length} connected`}
          icon={<Person className="h-4 w-4" weight="bold" />}
          iconVisible
        />
      </div>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-1.5 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[--radius] border border-border bg-card shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Users
                    className="h-4 w-4 text-healthy-ink"
                    weight="duotone"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Membros Conectados
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground transition-colors hover:text-muted-foreground"
                >
                  <X weight="bold" className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted px-3 py-2">
                <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Total
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {stats.total}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Global
                  </p>
                  <p className="text-sm font-semibold text-healthy-ink">
                    {stats.global}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Campanha
                  </p>
                  <p className="text-sm font-semibold text-primary-ink">
                    {stats.campaign}
                  </p>
                </div>
              </div>

              <div className="max-h-[380px] space-y-2 overflow-y-auto px-3 py-2.5">
                {connectedUsers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum usuário conectado
                  </div>
                ) : (
                  connectedUsers.map((user) => (
                    <div
                      key={`${user.user_id}-${user.connected_at}`}
                      className="rounded-lg border border-border bg-card p-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {user.email}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                            ID: {formatUserId(user.user_id)}
                          </p>
                        </div>
                        <span className="flex items-center gap-1 rounded-[--radius] bg-healthy px-2 py-0.5 text-[11px] font-semibold text-healthy-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          Online
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Broadcast
                            className="h-3 w-3 text-muted-foreground"
                            weight="duotone"
                          />
                          <span className="font-semibold text-muted-foreground">
                            Modo:
                          </span>
                          <span>
                            {user.view_mode === "global"
                              ? "Global"
                              : user.campaign_name || "Campanha específica"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <ClockCounterClockwise
                            className="h-3 w-3 text-muted-foreground"
                            weight="duotone"
                          />
                          <span className="font-semibold text-muted-foreground">
                            Conectado por:
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatDuration(user.connected_at, now)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <CalendarBlank
                            className="h-3 w-3 text-muted-foreground"
                            weight="duotone"
                          />
                          <span className="font-semibold text-muted-foreground">
                            Desde:
                          </span>
                          <span>{formatConnectedSince(user.connected_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
