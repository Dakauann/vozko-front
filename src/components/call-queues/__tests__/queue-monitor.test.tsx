import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { QueueLive, QueueStats } from "@/lib/call-routing/types";

const data = vi.hoisted(() => ({ live: [] as QueueLive[], stats: [] as QueueStats[], windows: [] as string[][] }));

vi.mock("@/app/actions/call-routing", () => ({
  getLiveQueuesAction: () => Promise.resolve({ queues: data.live }),
  getQueueStatsAction: (from: string, to: string) => {
    data.windows.push([from, to]);
    return Promise.resolve({ stats: data.stats });
  },
}));

import { QueueMonitor } from "@/components/call-queues/queue-monitor";

const suporte: QueueLive = {
  id: "q1",
  name: "Suporte",
  waiting: [
    { callId: "c1", remoteNumber: "5584994409684", waitingSeconds: 75 },
    { callId: "c2", remoteNumber: "", waitingSeconds: 10 },
  ],
  longestWaitSeconds: 75,
  agents: [
    { userId: "u1", name: "Ana", state: "on_call" },
    { userId: "u2", name: "Bia", state: "wrap_up" },
  ],
  counts: { free: 0, ringing: 0, onCall: 1, wrapUp: 1, offline: 0 },
};

async function renderMonitor() {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <QueueMonitor />
    </NextIntlClientProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

describe("QueueMonitor", () => {
  beforeEach(() => {
    data.live = [suporte];
    data.stats = [{ queueId: "q1", offered: 10, answered: 8, abandoned: 2, timedOut: 0, averageAnswerSeconds: 14, serviceLevel: 0.7, serviceLevelTargetSeconds: 20 }];
    data.windows = [];
  });

  afterEach(() => vi.useRealTimers());

  it("shows how many wait, the longest wait and today's numbers", async () => {
    await renderMonitor();
    expect(screen.getByText("Esperando agora").nextSibling?.textContent).toBe("2");
    expect(screen.getByText("Nível de serviço hoje").nextSibling?.textContent).toBe("70%");
    expect(screen.getByText("2 esperando · atenção")).toBeTruthy();
    expect(screen.getByText("Maior espera 1:15")).toBeTruthy();
    expect(screen.getByText("Hoje: 8 atendidas · 2 desistiram · espera média 0:14 · nível 70%")).toBeTruthy();
    expect(data.windows[0]).toHaveLength(2);
  });

  it("opens a queue to show who is in line and what each agent is doing", async () => {
    await renderMonitor();
    fireEvent.click(screen.getByRole("button", { name: /Suporte/ }));
    expect(screen.getByText("Número oculto", { exact: false })).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getAllByText("Em pausa").length).toBeGreaterThan(0);
  });

  it("stays out of the way when the workspace has no queues", async () => {
    data.live = [];
    await renderMonitor();
    expect(screen.queryByText("Agora nas filas")).toBeNull();
  });
});
