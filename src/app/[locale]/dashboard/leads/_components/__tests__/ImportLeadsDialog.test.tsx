/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportLeadsDialog } from "../ImportLeadsDialog";

/**
 * The dialog's job around scripted seeding is to offer it to exactly the right
 * person, only where it can work, and never to send a request the server will
 * refuse. The server enforces all three independently; these pin the half the
 * operator actually sees.
 */

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

// The CHANNEL permission. Separate from the platform role below, which is the
// whole point of the gate being two questions rather than one.
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

// The workspace media library the opening's attachment is uploaded to.
const uploadMediaActionMock = vi.fn();
vi.mock("@/app/actions/medias", () => ({
  uploadMediaAction: (...args: unknown[]) => uploadMediaActionMock(...args),
}));

vi.mock("@/lib/csv/parse", () => ({
  readDelimitedFile: vi.fn(),
}));

// The file is parsed in the browser; here it is supplied directly so the tests
// are about the panel, not about CSV parsing (which has its own tests).
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

/**
 * Pretends the operator chose a file, which is what reveals the options.
 *
 * Queried off the document rather than the render container: Radix renders the
 * dialog into a portal on document.body, so the container is empty.
 */
async function chooseAFile() {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File(["telefone,nome\n"], "leads.csv", { type: "text/csv" });
  Object.defineProperty(input, "files", { value: [file] });
  fireEvent.change(input);
  // The column mapping always appears once a file is chosen, whatever the
  // caller's permissions are; waiting on the seeding checkbox would hang in the
  // very case where its absence is the thing under test.
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

// The panel depends on the checkbox above it, because the server refuses the
// combination with a 400. An operator should not be able to compose a request
// that cannot be honoured.
it("hides the script panel until inbox seeding is ticked", async () => {
  renderDialog();
  await chooseAFile();

  expect(screen.queryByText("seedConversations.label")).toBeNull();
  tick("seedInbox.label");
  expect(screen.getByText("seedConversations.label")).toBeTruthy();
});

// The PLATFORM role, not the workspace one. A workspace owner passes `can()`
// and is still not who this is for, because it spends the workspace's balance.
it("hides the script panel from anyone who is not a platform admin", async () => {
  useAuthMock.mockReturnValue({ user: { id: "u-1", role: "user" } });
  renderDialog();
  await chooseAFile();

  tick("seedInbox.label");
  expect(screen.getByText("seedInbox.label")).toBeTruthy();
  expect(screen.queryByText("seedConversations.label")).toBeNull();
});

// Without the channel permission there is nothing to seed into, so neither
// checkbox appears. Two gates, both of which must pass.
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

  // The same rule the server applies. The preview should not promise an
  // outcome the import will refuse.
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

  // The count an operator needs BEFORE committing. Afterwards it only shows up
  // as a scripted total smaller than the one they expected.
  it("warns how many rows have no name to render", async () => {
    parsedRows = [
      { line: 1, number: "5511999999999", name: "Marina" },
      { line: 2, number: "5511988888888" },
      { line: 3, number: "5511977777777", name: "  " },
    ];
    await openPanel();

    // No warning while the opening does not use the name.
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
    // Trimmed, and with the default thread length.
    expect(script).toEqual({
      bodies: ["Oi {{1}}, tudo bem?"],
      maxMessages: 4,
    });
  });

  /** The picker's own input, which is the one added after the CSV input. */
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

  // The attachment is optional, and an operator who never opened the picker
  // should send exactly the script this feature shipped as.
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

    // The field names are the upload endpoint's, which refuses anything else.
    const form = uploadMediaActionMock.mock.calls[0][0] as FormData;
    expect(form.get("mediaType")).toBe("image");
    expect(form.get("media")).toBeInstanceOf(File);
    expect(form.get("description")).toBe("catalogo.jpg");

    await waitFor(() => expect(importButton().disabled).toBe(false));
    fireEvent.click(importButton());
    await waitFor(() => expect(importLeadsActionMock).toHaveBeenCalled());

    const [, , , script] = importLeadsActionMock.mock.calls[0];
    expect(script.attachment).toEqual({ mediaId: "media-1", kind: "image" });
    // The bodies are the caption, not something the file replaced.
    expect(script.bodies).toEqual(["Oi {{1}}?"]);
  });

  // A stale `true` can never be sent: the server refuses a script without
  // seedInbox with a 400, and changing your mind should not meet it.
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

// An import that never opened the panel must send exactly what it always sent.
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
