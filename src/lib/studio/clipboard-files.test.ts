import { describe, expect, it } from "vitest";

import { imageFilesFrom } from "./clipboard-files";

function file(name: string, type: string, size = 4): File {
  return new File([new Uint8Array(size)], name, { type });
}

function item(f: File | null, kind = "file"): DataTransferItem {
  return { kind, type: f?.type ?? "text/plain", getAsFile: () => f } as unknown as DataTransferItem;
}

function transfer(items: DataTransferItem[], files: File[] = []): Pick<DataTransfer, "items" | "files"> {
  return { items: items as unknown as DataTransferItemList, files: files as unknown as FileList };
}

describe("images on the clipboard", () => {
  it("reads images exposed only as clipboard items, like screenshots", () => {
    const shot = file("image.png", "image/png");
    expect(imageFilesFrom(transfer([item(shot), item(null, "string")]))).toEqual([shot]);
  });

  it("falls back to the file list and never returns the same image twice", () => {
    const photo = file("photo.webp", "image/webp");
    expect(imageFilesFrom(transfer([], [photo]))).toEqual([photo]);
    expect(imageFilesFrom(transfer([item(photo)], [photo]))).toEqual([photo]);
  });

  it("ignores anything that is not an image", () => {
    expect(imageFilesFrom(transfer([item(file("a.pdf", "application/pdf"))], [file("b.txt", "text/plain")]))).toEqual([]);
  });
});
