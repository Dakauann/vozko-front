"use client";

import { canStart } from "@/lib/media-generation/limits";
import { elementStyleFor } from "@/lib/studio/library/element-prompt";

import { ElementGenerator } from "../library/element-generator";
import { jobKind, useEditorUi, useImageEditor } from "./editor-state";
import { JobStatusList, useJobsFor } from "./jobs";

export function ImageElementGenerator({ categoryId }: { categoryId: string }) {
  const { commands } = useImageEditor();
  const jobs = useJobsFor("element", null);
  const running = useEditorUi((s) => s.jobs).filter((job) => !job.error).map((job) => jobKind(job.purpose));
  return (
    <ElementGenerator style={elementStyleFor(categoryId)} blocked={!canStart("image", running)} onGenerate={(prompt, model) => void commands.startJob("element", { kind: "image", model, prompt, aspect: "square" })}>
      <JobStatusList jobs={jobs} frame="square" />
    </ElementGenerator>
  );
}
