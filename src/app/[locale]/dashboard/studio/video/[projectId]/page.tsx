"use client";

import { use } from "react";

import { StudioEditorShell } from "@/components/studio/studio-editor-shell";
import { VideoEditor } from "@/components/studio/video/video-editor";

export default function StudioVideoPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <StudioEditorShell projectId={projectId} kind="video">
      {(mount) => <VideoEditor {...mount} />}
    </StudioEditorShell>
  );
}
