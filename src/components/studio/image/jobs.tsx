"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { X } from "@/components/icons";
import { useMediaGeneration } from "@/hooks/use-media-generation";

import { IconButton, Notice } from "./controls";
import { useEditorUi, useImageEditor, type JobPurpose, type StudioJob } from "./editor-state";

function JobFollower({ job }: { job: StudioJob }) {
  const { commands } = useImageEditor();
  const generation = useMediaGeneration({ onDone: ({ mediaId }) => void commands.jobDone(job.id, mediaId) });
  const created = useRef(job.created);
  const follow = useRef(generation.follow);

  useEffect(() => {
    const first = created.current;
    if (first) void follow.current(() => Promise.resolve({ data: first }));
  }, []);

  useEffect(() => {
    if (generation.error) commands.jobFailed(job.id, generation.error.code);
  }, [generation.error, commands, job.id]);

  useEffect(() => {
    if (generation.status === "generating") commands.jobProgress(job.id, generation.settling);
  }, [generation.status, generation.settling, commands, job.id]);

  return null;
}

export function JobFollowers() {
  const jobs = useEditorUi((s) => s.jobs);
  return (
    <>
      {jobs
        .filter((job) => job.created && !job.error)
        .map((job) => (
          <JobFollower key={job.id} job={job} />
        ))}
    </>
  );
}

export function useJobsFor(purpose: JobPurpose, layerId: string | null): StudioJob[] {
  const jobs = useEditorUi((s) => s.jobs);
  return jobs.filter((job) => job.purpose === purpose && job.layerId === layerId);
}

export function JobStatusList({ jobs }: { jobs: StudioJob[] }) {
  const t = useTranslations("studio.image.jobs");
  const { commands } = useImageEditor();
  if (jobs.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {jobs.map((job) => (
        <li key={job.id}>
          {job.error ? (
            <Notice
              tone="fault"
              title={t(`failed.${job.purpose}`)}
              action={
                <IconButton label={t("dismiss")} onClick={() => commands.dismissJob(job.id)} className="-my-1 -mr-1 h-6 min-w-6">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </IconButton>
              }
            >
              {t(`errors.${job.error}`)}
            </Notice>
          ) : (
            <Notice tone="progress" title={t(job.settling ? "finalizing" : `running.${job.purpose}`)} />
          )}
        </li>
      ))}
    </ul>
  );
}
