import type { CodedError } from "@/lib/api/coded-error";
import { MAX_CONSECUTIVE_POLL_ERRORS, nextPollDelay } from "@/lib/media-generation/polling";

import {
  isLeadImportActive,
  type LeadImportJob,
  type LeadImportLimits,
  type LeadImportList,
  type LeadImportSummary,
} from "./imports";

export const MAX_TRACKED_IMPORTS = 20;

const GONE_STATUS = 404;

export type LeadImportFetch = (id: string) => Promise<{ job: LeadImportJob } | { error: CodedError }>;

export type LeadImportListFetch = () => Promise<{ list: LeadImportList } | { error: CodedError }>;

export interface TrackedLeadImport {
  id: string;
  summary: LeadImportSummary;
  job: LeadImportJob | null;
  pollError: CodedError | null;
  gone: boolean;
}

interface Poller {
  timer: ReturnType<typeof setTimeout> | null;
  delay: number | null;
  errors: number;
  generation: number;
  wanted: boolean;
}

interface ListLoader {
  timer: ReturnType<typeof setTimeout> | null;
  delay: number | null;
  errors: number;
}

export class LeadImportTracker {
  private entries: TrackedLeadImport[] = [];
  private snapshot: readonly TrackedLeadImport[] = [];
  private limits: LeadImportLimits | null = null;
  private readonly dismissed = new Set<string>();
  private readonly pollers = new Map<string, Poller>();
  private readonly list: ListLoader = { timer: null, delay: null, errors: 0 };
  private readonly listeners = new Set<() => void>();
  private readonly settleListeners = new Set<(job: LeadImportSummary) => void>();
  private watchers = 0;

  constructor(private readonly deps: { fetchJob: LeadImportFetch; fetchList?: LeadImportListFetch | null }) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.watchers += 1;
    if (this.watchers === 1) this.resume();
    return () => {
      this.listeners.delete(listener);
      this.watchers = Math.max(0, this.watchers - 1);
      if (this.watchers === 0) this.pause();
    };
  };

  getSnapshot = (): readonly TrackedLeadImport[] => this.snapshot;

  getLimits = (): LeadImportLimits | null => this.limits;

  get(id: string): TrackedLeadImport | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  onSettled(listener: (job: LeadImportSummary) => void): () => void {
    this.settleListeners.add(listener);
    return () => {
      this.settleListeners.delete(listener);
    };
  }

  track(job: LeadImportJob): void {
    this.dismissed.delete(job.id);
    const previous = this.get(job.id);
    const entry: TrackedLeadImport = { id: job.id, summary: job, job, pollError: null, gone: false };
    this.entries = [entry, ...this.entries.filter((current) => current.id !== job.id)];
    this.trim();
    const poller = this.poller(job.id);
    this.clearTimer(poller);
    poller.generation += 1;
    poller.delay = nextPollDelay(null);
    poller.errors = 0;
    poller.wanted = false;
    this.publish();
    this.announce(previous?.summary ?? null, job);
    if (isLeadImportActive(job.status)) this.schedule(job.id, poller.delay);
  }

  load(id: string): void {
    const entry = this.get(id);
    if (!entry || entry.job || entry.gone || entry.pollError) return;
    this.poller(id).wanted = true;
    this.schedule(id, 0);
  }

  forget(id: string): void {
    this.stop(id);
    this.pollers.delete(id);
    this.dismissed.add(id);
    this.entries = this.entries.filter((entry) => entry.id !== id);
    this.publish();
  }

  retry(id: string): void {
    const entry = this.get(id);
    if (!entry) return;
    const poller = this.poller(id);
    this.clearTimer(poller);
    poller.errors = 0;
    poller.delay = null;
    this.replace({ ...entry, pollError: null });
    this.schedule(id, 0);
  }

  private resume(): void {
    this.list.errors = 0;
    this.list.delay = null;
    this.scheduleList(0);
    for (const entry of this.entries) this.follow(entry);
  }

  private follow(entry: TrackedLeadImport): void {
    if (entry.gone || entry.pollError) return;
    const poller = this.poller(entry.id);
    if (isLeadImportActive(entry.summary.status)) {
      poller.delay = poller.delay ?? nextPollDelay(null);
      this.schedule(entry.id, entry.job === null && poller.wanted ? 0 : poller.delay);
    } else if (entry.job === null && poller.wanted) {
      this.schedule(entry.id, 0);
    }
  }

  private pause(): void {
    for (const poller of this.pollers.values()) this.clearTimer(poller);
    if (this.list.timer !== null) {
      clearTimeout(this.list.timer);
      this.list.timer = null;
    }
  }

  private stop(id: string): void {
    const poller = this.pollers.get(id);
    if (!poller) return;
    this.clearTimer(poller);
    poller.generation += 1;
  }

  private scheduleList(delay: number): void {
    if (!this.deps.fetchList || this.watchers === 0 || this.list.timer !== null) return;
    this.list.timer = setTimeout(() => {
      this.list.timer = null;
      void this.loadList();
    }, delay);
  }

  private async loadList(): Promise<void> {
    const fetchList = this.deps.fetchList;
    if (!fetchList) return;
    let outcome: Awaited<ReturnType<LeadImportListFetch>>;
    try {
      outcome = await fetchList();
    } catch (error) {
      outcome = { error: { message: error instanceof Error ? error.message : String(error) } };
    }
    if ("error" in outcome) {
      this.list.errors += 1;
      if (this.list.errors >= MAX_CONSECUTIVE_POLL_ERRORS) return;
      this.list.delay = nextPollDelay(this.list.delay);
      this.scheduleList(this.list.delay);
      return;
    }
    this.list.errors = 0;
    this.list.delay = null;
    this.limits = outcome.list.limits;
    this.absorb(outcome.list.items);
  }

  private absorb(items: readonly LeadImportSummary[]): void {
    const settled: [LeadImportSummary, LeadImportSummary][] = [];
    const added: TrackedLeadImport[] = [];
    const listed = new Map(items.map((item) => [item.id, item]));
    this.entries = this.entries.map((entry) => {
      const item = listed.get(entry.id);
      if (!item || entry.job || entry.gone) return entry;
      settled.push([entry.summary, item]);
      return { ...entry, summary: item };
    });
    for (const item of items) {
      if (this.dismissed.has(item.id) || this.get(item.id) || added.some((entry) => entry.id === item.id)) continue;
      added.push({ id: item.id, summary: item, job: null, pollError: null, gone: false });
    }
    this.entries = [...this.entries, ...added];
    this.trim();
    this.publish();
    for (const [previous, next] of settled) this.announce(previous, next);
    for (const entry of this.entries) this.follow(entry);
  }

  private schedule(id: string, delay: number): void {
    if (this.watchers === 0) return;
    const poller = this.poller(id);
    if (poller.timer !== null) return;
    poller.timer = setTimeout(() => {
      poller.timer = null;
      void this.poll(id);
    }, delay);
  }

  private async poll(id: string): Promise<void> {
    const poller = this.poller(id);
    const generation = poller.generation;
    let outcome: Awaited<ReturnType<LeadImportFetch>>;
    try {
      outcome = await this.deps.fetchJob(id);
    } catch (error) {
      outcome = { error: { message: error instanceof Error ? error.message : String(error) } };
    }
    const entry = this.get(id);
    if (!entry || generation !== poller.generation) return;

    if ("error" in outcome) {
      if (outcome.error.status === GONE_STATUS) {
        poller.wanted = false;
        this.replace({ ...entry, gone: true, pollError: null });
        return;
      }
      poller.errors += 1;
      if (poller.errors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        this.replace({ ...entry, pollError: outcome.error });
        return;
      }
      poller.delay = nextPollDelay(poller.delay);
      this.schedule(id, poller.delay);
      return;
    }

    poller.errors = 0;
    poller.wanted = false;
    const job = outcome.job;
    this.replace({ ...entry, summary: job, job, pollError: null, gone: false });
    this.announce(entry.summary, job);
    if (isLeadImportActive(job.status)) {
      poller.delay = nextPollDelay(poller.delay);
      this.schedule(id, poller.delay);
    } else {
      poller.delay = null;
    }
  }

  private announce(previous: LeadImportSummary | null, next: LeadImportSummary): void {
    if (!previous || !isLeadImportActive(previous.status) || isLeadImportActive(next.status)) return;
    for (const listener of this.settleListeners) listener(next);
  }

  private replace(entry: TrackedLeadImport): void {
    this.entries = this.entries.map((current) => (current.id === entry.id ? entry : current));
    this.publish();
  }

  private trim(): void {
    while (this.entries.length > MAX_TRACKED_IMPORTS) {
      const finished = this.lastIndexWhere((entry) => entry.gone || !isLeadImportActive(entry.summary.status));
      const index = finished >= 0 ? finished : this.entries.length - 1;
      const [dropped] = this.entries.splice(index, 1);
      this.stop(dropped.id);
      this.pollers.delete(dropped.id);
    }
  }

  private lastIndexWhere(test: (entry: TrackedLeadImport) => boolean): number {
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      if (test(this.entries[i])) return i;
    }
    return -1;
  }

  private poller(id: string): Poller {
    let poller = this.pollers.get(id);
    if (!poller) {
      poller = { timer: null, delay: null, errors: 0, generation: 0, wanted: false };
      this.pollers.set(id, poller);
    }
    return poller;
  }

  private clearTimer(poller: Poller): void {
    if (poller.timer !== null) {
      clearTimeout(poller.timer);
      poller.timer = null;
    }
  }

  private publish(): void {
    this.snapshot = [...this.entries];
    for (const listener of this.listeners) listener();
  }
}
