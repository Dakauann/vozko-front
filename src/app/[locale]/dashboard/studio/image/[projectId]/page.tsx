"use client";

import { use } from "react";

import { ImageEditor } from "@/components/studio/image/image-editor";
import { StudioEditorShell } from "@/components/studio/studio-editor-shell";

export default function StudioImagePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <StudioEditorShell projectId={projectId} kind="image">
      {(mount) => <ImageEditor {...mount} />}
    </StudioEditorShell>
  );
}
