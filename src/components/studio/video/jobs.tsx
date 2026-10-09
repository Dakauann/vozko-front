"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { useMediaGeneration, type MediaGenerationError, type MediaGenerationStatus } from "@/hooks/use-media-generation";

import { AgentCursor } from "../agent/agent-cursor";
import type { AgentTask } from "../agent/agent-tasks";
import type { AgentPresence } from "../agent/presence";
import { useVideoEditor, useViewState } from "./editor-context";
import { placeJobResult } from "./job-placement";
import type { VideoJob, VideoJobPurpose } from "./view-store";

function JobFollower({ job }: { job: VideoJob }) {
  const editor = useVideoEditor();
  const t = useTranslations("studio.video.captions");
  const trackName = t("trackName");
  const latest = useRef({ editor, trackName });
  const created = useRef(job.created);

  useEffect(() => {
    latest.current = { editor, trackName };
  }, [editor, trackName]);

  const generation = useMediaGeneration({
    onDone: ({ mediaId }) => {
      const { editor: current, trackName: name } = latest.current;
      void placeJobResult(job, mediaId, { store: current.store, commands: current.commands, assets: current.assets, captionTrackName: name }).then((problem) => {
        if (!problem) {
          current.commands.jobFinished(job.id);
          return;
        }
        current.commands.notify(problem, "error");
        current.commands.jobFailed(job.id, { code: "result_unavailable", message: problem });
      });
    },
  });
  const follow = useRef(generation.follow);

  useEffect(() => {
    const first = created.current;
    if (first) void follow.current(() => Promise.resolve({ data: first }));
  }, []);

  useEffect(() => {
    if (generation.error) editor.commands.jobFailed(job.id, generation.error);
  }, [generation.error, editor.commands, job.id]);

  useEffect(() => {
    if (generation.status === "generating") editor.commands.jobProgress(job.id, generation.settling);
  }, [generation.status, generation.settling, editor.commands, job.id]);

  return null;
}

export function VideoJobFollowers() {
  const jobs = useViewState((s) => s.jobs);
  return (
    <>
      {jobs
        .filter((job) => job.created && job.state === "running")
        .map((job) => (
          <JobFollower key={job.id} job={job} />
        ))}
    </>
  );
}

export interface JobStatusView {
  status: MediaGenerationStatus;
  settling: boolean;
  error?: MediaGenerationError;
}

export function jobStatusOf(job: VideoJob | undefined): JobStatusView {
  if (!job) return { status: "idle", settling: false };
  if (job.state === "failed") return { status: "failed", settling: false, error: job.error ?? undefined };
  if (job.state === "done") return { status: "done", settling: false };
  return { status: "generating", settling: job.settling };
}

export function useJobs(purpose: VideoJobPurpose): VideoJob[] {
  const jobs = useViewState((s) => s.jobs);
  return useMemo(() => jobs.filter((job) => job.purpose === purpose).reverse(), [jobs, purpose]);
}

export function agentTasks(jobs: readonly VideoJob[]): AgentTask[] {
  return jobs.filter((job) => job.byAgent && job.state === "running").map((job) => ({ id: job.id, action: `job_${job.purpose}`, settling: job.settling }));
}

export function VideoAgentCursor({ presence }: { presence: AgentPresence }) {
  const jobs = useViewState((s) => s.jobs);
  const tasks = useMemo(() => agentTasks(jobs), [jobs]);
  return <AgentCursor presence={presence} tasks={tasks} anchor="[data-studio-preview]" />;
}

export function useRunningKinds(): VideoJobPurpose[] {
  const jobs = useViewState((s) => s.jobs);
  return useMemo(() => jobs.filter((job) => job.state === "running").map((job) => job.purpose), [jobs]);
}
