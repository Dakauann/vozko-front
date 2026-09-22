"use client";

import {
  DownloadIcon,
  SubsetProperOfIcon,
} from "@/components/icons";
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
