
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportLeadsDialog } from "../ImportLeadsDialog";


vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    return t;
  },
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const canMock = vi.fn().mockReturnValue(true);
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: canMock }),
}));

const useAuthMock = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

const importLeadsActionMock = vi.fn();
vi.mock("@/app/actions/leads", () => ({
  importLeadsAction: (...args: unknown[]) => importLeadsActionMock(...args),
  LEAD_IMPORT_MAX_ROWS: 100000,
}));

vi.mock("@/lib/leads/template", () => ({
  downloadLeadImportTemplate: vi.fn(),
}));

const uploadMediaActionMock = vi.fn();
vi.mock("@/app/actions/medias", () => ({
  uploadMediaAction: (...args: unknown[]) => uploadMediaActionMock(...args),
}));

vi.mock("@/lib/csv/parse", () => ({
  readDelimitedFile: vi.fn(),
}));

let parsedRows: { line: number; number: string; name?: string }[] = [];
vi.mock("@/lib/leads/import", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/leads/import")>(
      "@/lib/leads/import",
    );
  return {
    ...actual,
    readLeadImportFile: () => ({
      headers: ["telefone", "nome"],
      rows: [],
      columnCount: 2,
      guess: { number: 0, name: 1, age: null },
    }),
    buildLeadImportRows: () => ({
      rows: parsedRows,
      rejected: [],
      invalid: 0,
      duplicates: 0,
    }),
  };
});

function renderDialog() {
  return render(
    <ImportLeadsDialog open onOpenChange={() => {}} onImported={() => {}} />,
  );
}

async function chooseAFile() {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File(["telefone,nome\n"], "leads.csv", { type: "text/csv" });
  Object.defineProperty(input, "files", { value: [file] });
  fireEvent.change(input);
  await waitFor(() => screen.getByText("mapping.title"));
}

function tick(label: string) {
  fireEvent.click(screen.getByText(label));
}

beforeEach(() => {
  vi.clearAllMocks();
  canMock.mockReturnValue(true);
  useAuthMock.mockReturnValue({ user: { id: "u-1", role: "admin" } });
  uploadMediaActionMock.mockResolvedValue({
    mediaId: "media-1",
    mediaUrl: "https://cdn.example/abc.jpg",
  });
  importLeadsActionMock.mockResolvedValue({
    result: { created: 1, matched: 0, blocked: 0, invalid: 0, duplicate: 0, rejected: [] },
    error: null,
  });
  parsedRows = [
    { line: 1, number: "5511999999999", name: "Marina" },
    { line: 2, number: "5511988888888", name: "Joao" },
  ];
});

it("hides the script panel until inbox seeding is ticked", async () => {
  renderDialog();
  await chooseAFile();

  expect(screen.queryByText("seedConversations.label")).toBeNull();
  tick("seedInbox.label");
  expect(screen.getByText("seedConversations.label")).toBeTruthy();
});

it("hides the script panel from anyone who is not a platform admin", async () => {
  useAuthMock.mockReturnValue({ user: { id: "u-1", role: "user" } });
  renderDialog();
  await chooseAFile();

  tick("seedInbox.label");
  expect(screen.getByText("seedInbox.label")).toBeTruthy();
  expect(screen.queryByText("seedConversations.label")).toBeNull();
});

it("hides both checkboxes without the channel permission", async () => {
  canMock.mockReturnValue(false);
  renderDialog();
  await chooseAFile();

  expect(screen.queryByText("seedInbox.label")).toBeNull();
});

describe("once the script panel is open", () => {
  async function openPanel() {
    renderDialog();
    await chooseAFile();
    tick("seedInbox.label");
    tick("seedConversations.label");
    await waitFor(() => screen.getByText("seedConversations.variantsTitle"));
  }

  function firstMessageBox() {
    return document.querySelector("textarea") as HTMLTextAreaElement;
  }

  function importButton() {
    return screen.getByText("confirm").closest("button") as HTMLButtonElement;
  }

  it("blocks the import while the first message is empty", async () => {
    await openPanel();
    expect(importButton().disabled).toBe(true);
    expect(screen.getByText("seedConversations.invalid")).toBeTruthy();

    fireEvent.change(firstMessageBox(), {
      target: { value: "Oi {{1}}, tudo bem?" },
    });
    await waitFor(() => expect(importButton().disabled).toBe(false));
  });

  it("blocks the import when variants use different variables", async () => {
    await openPanel();
    fireEvent.change(firstMessageBox(), {
      target: { value: "Oi {{1}}" },
    });
    await waitFor(() => expect(importButton().disabled).toBe(false));

    fireEvent.click(screen.getByText("seedConversations.addVariant"));
    const boxes = document.querySelectorAll("textarea");
    fireEvent.change(boxes[1], { target: { value: "Oi {{2}}" } });

    await waitFor(() => expect(importButton().disabled).toBe(true));
    expect(screen.getByText("seedConversations.variantsMismatch")).toBeTruthy();
  });

  it("warns how many rows have no name to render", async () => {
    parsedRows = [
      { line: 1, number: "5511999999999", name: "Marina" },
      { line: 2, number: "5511988888888" },
      { line: 3, number: "5511977777777", name: "  " },
    ];
    await openPanel();

    fireEvent.change(firstMessageBox(), {
      target: { value: "Oi, tudo bem?" },
    });
    await waitFor(() =>
      expect(screen.queryByText("seedConversations.unnamedRows")).toBeNull(),
    );

    fireEvent.change(firstMessageBox(), {
      target: { value: "Oi {{1}}, tudo bem?" },
    });
    await waitFor(() =>
      expect(screen.getByText("seedConversations.unnamedRows")).toBeTruthy(),
    );
  });

  it("sends the script exactly as it was written", async () => {
    await openPanel();
    fireEvent.change(firstMessageBox(), {
      target: { value: "  Oi {{1}}, tudo bem?  " },
    });
    await waitFor(() => expect(importButton().disabled).toBe(false));

    fireEvent.click(importButton());
    await waitFor(() => expect(importLeadsActionMock).toHaveBeenCalled());

    const [rows, onExisting, seedInbox, script] =
      importLeadsActionMock.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(onExisting).toBe("fill_empty");
    expect(seedInbox).toBe(true);
    expect(script).toEqual({
      bodies: ["Oi {{1}}, tudo bem?"],
      maxMessages: 4,
    });
  });

  function attachmentInput() {
    const inputs = document.querySelectorAll('input[type="file"]');
    return inputs[inputs.length - 1] as HTMLInputElement;
  }

  async function attachAFile() {
    const file = new File(["..."], "catalogo.jpg", { type: "image/jpeg" });
    const input = attachmentInput();
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() => expect(uploadMediaActionMock).toHaveBeenCalled());
  }

  it("sends no attachment when no file was picked", async () => {
    await openPanel();
    fireEvent.change(firstMessageBox(), { target: { value: "Oi {{1}}?" } });
    await waitFor(() => expect(importButton().disabled).toBe(false));

    fireEvent.click(importButton());
    await waitFor(() => expect(importLeadsActionMock).toHaveBeenCalled());
    const [, , , script] = importLeadsActionMock.mock.calls[0];
    expect(script.attachment).toBeUndefined();
  });

  it("sends the picked file as the opening's attachment", async () => {
    await openPanel();
    fireEvent.change(firstMessageBox(), { target: { value: "Oi {{1}}?" } });
    await attachAFile();

    const form = uploadMediaActionMock.mock.calls[0][0] as FormData;
    expect(form.get("mediaType")).toBe("image");
    expect(form.get("media")).toBeInstanceOf(File);
    expect(form.get("description")).toBe("catalogo.jpg");

    await waitFor(() => expect(importButton().disabled).toBe(false));
    fireEvent.click(importButton());
    await waitFor(() => expect(importLeadsActionMock).toHaveBeenCalled());

    const [, , , script] = importLeadsActionMock.mock.calls[0];
    expect(script.attachment).toEqual({ mediaId: "media-1", kind: "image" });
    expect(script.bodies).toEqual(["Oi {{1}}?"]);
  });

  it("drops the script when inbox seeding is unticked", async () => {
    await openPanel();
    fireEvent.change(firstMessageBox(), {
      target: { value: "Oi {{1}}, tudo bem?" },
    });
    await waitFor(() => expect(importButton().disabled).toBe(false));

    tick("seedInbox.label");
    await waitFor(() =>
      expect(screen.queryByText("seedConversations.label")).toBeNull(),
    );

    fireEvent.click(importButton());
    await waitFor(() => expect(importLeadsActionMock).toHaveBeenCalled());
    const [, , seedInbox, script] = importLeadsActionMock.mock.calls[0];
    expect(seedInbox).toBe(false);
    expect(script).toBeUndefined();
  });
});

it("sends no script when the panel was never opened", async () => {
  renderDialog();
  await chooseAFile();
  tick("seedInbox.label");

  fireEvent.click(screen.getByText("confirm").closest("button")!);
  await waitFor(() => expect(importLeadsActionMock).toHaveBeenCalled());
  const [, , seedInbox, script] = importLeadsActionMock.mock.calls[0];
  expect(seedInbox).toBe(true);
  expect(script).toBeUndefined();
});
