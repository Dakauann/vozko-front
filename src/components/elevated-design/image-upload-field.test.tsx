import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ImageUploadField, type ImageUploadLabels } from "./image-upload-field";

const labels: ImageUploadLabels = {
  title: "Imagem",
  add: "Adicionar imagem",
  replace: "Trocar imagem",
  remove: "Tirar imagem",
  uploading: "Enviando",
  hint: "PNG, JPG ou WebP",
};

function pick(file: File) {
  fireEvent.change(screen.getByLabelText(labels.add), { target: { files: [file] } });
}

const png = new File(["x"], "logo.png", { type: "image/png" });

describe("ImageUploadField", () => {
  it("uploads the chosen file and hands back what the upload returned", async () => {
    const upload = vi.fn(async () => ({ value: { id: "m-1" } }));
    const onUploaded = vi.fn();
    render(<ImageUploadField labels={labels} previewUrl="" accept={["image/png"]} check={() => null} upload={upload} onUploaded={onUploaded} onRemove={() => undefined} />);
    pick(png);
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ id: "m-1" }));
    expect(upload).toHaveBeenCalledWith(png);
  });

  it("refuses a file the check rejects without uploading it", async () => {
    const upload = vi.fn();
    render(<ImageUploadField labels={labels} previewUrl="" accept={["image/png"]} check={() => "Arquivo grande demais"} upload={upload} onUploaded={() => undefined} onRemove={() => undefined} />);
    pick(png);
    expect(await screen.findByRole("alert")).toHaveTextContent("Arquivo grande demais");
    expect(upload).not.toHaveBeenCalled();
  });

  it("states an upload failure and keeps the current image", async () => {
    const onUploaded = vi.fn();
    render(
      <ImageUploadField
        labels={labels}
        previewUrl="https://cdn/logo.png"
        accept={["image/png"]}
        check={() => null}
        upload={async () => ({ error: "Falha no envio" })}
        onUploaded={onUploaded}
        onRemove={() => undefined}
      />,
    );
    pick(png);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha no envio");
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: labels.replace })).toBeInTheDocument();
  });

  it("offers removal only when there is an image, and nothing at all while disabled", () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <ImageUploadField labels={labels} previewUrl="https://cdn/logo.png" accept={["image/png"]} check={() => null} upload={vi.fn()} onUploaded={() => undefined} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByRole("button", { name: labels.remove }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    rerender(<ImageUploadField labels={labels} previewUrl="" accept={["image/png"]} check={() => null} upload={vi.fn()} onUploaded={() => undefined} onRemove={onRemove} />);
    expect(screen.queryByRole("button", { name: labels.remove })).not.toBeInTheDocument();
    rerender(
      <ImageUploadField labels={labels} previewUrl="https://cdn/logo.png" accept={["image/png"]} check={() => null} upload={vi.fn()} onUploaded={() => undefined} onRemove={onRemove} disabled />,
    );
    expect(screen.getByRole("button", { name: labels.replace })).toBeDisabled();
    expect(screen.queryByRole("button", { name: labels.remove })).not.toBeInTheDocument();
  });
});
