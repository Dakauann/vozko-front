"use client";

import { canStart } from "@/lib/media-generation/limits";
import { elementStyleFor } from "@/lib/studio/library/element-prompt";

import { ElementGenerator } from "../../library/element-generator";
import { useVideoEditor } from "../editor-context";
import { useJobs, useRunningKinds } from "../jobs";
import { JobList } from "./job-status";

export function VideoElementGenerator({ categoryId }: { categoryId: string }) {
  const { commands, view } = useVideoEditor();
  const jobs = useJobs("image").filter((job) => job.target.thenCutout);
  const blocked = !canStart("image", useRunningKinds());
  return (
    <ElementGenerator style={elementStyleFor(categoryId)} blocked={blocked} onGenerate={(prompt, model) => void commands.startJob("image", { kind: "image", model, prompt, aspect: "square" }, { atMs: view.getState().playheadMs, thenCutout: true })}>
      <JobList kind="image" jobs={jobs} blocked={blocked} frame="square" />
    </ElementGenerator>
  );
}
