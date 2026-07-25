"use client";

import {
  DownloadIcon,
  SubsetProperOfIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";

import dynamic from "next/dynamic";

import Button from "../elevated-design/button";

// reactjs-file-preview touches browser-only APIs (DOMMatrix) at module load, so
// it must never evaluate during SSR (that throws "DOMMatrix is not defined" and
// forces a client-render fallback). Load it client-only.
const FilePreview = dynamic(() => import("reactjs-file-preview"), {
  ssr: false,
});

export default function DocumentPreview({
  previewDocumentUrl,
  open,
  setOpen,
}: {
  previewDocumentUrl: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <ElevatedDialog open={open}>
      <ElevatedDialogContent className="w-full h-full max-h-[90vh] overflow-y-auto">
        <div className="w-full h-full">
          <FilePreview preview={previewDocumentUrl} />
        </div>
        <ElevatedDialogFooter>
          <Button
            icon={<DownloadIcon />}
            variant="outline"
            onClick={() => window.open(previewDocumentUrl, "_blank")}
            iconVisible
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
