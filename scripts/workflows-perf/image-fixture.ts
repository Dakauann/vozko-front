import type { Media } from "@/lib/medias/types";
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from "@/lib/workflows/types";

export const IMAGE_FIXTURE_SHAPE = { nodes: 45, media: 18, largeImages: 12, previews: 4, links: 2, videos: 2 } as const;

const COLUMN_GAP = 340;
const ROW_GAP = 360;
const ROWS = 5;

type MediaKind = "large" | "preview" | "link" | "video";

const ROW_PLANS: WorkflowNodeType[][] = [
  ["trigger_webhook", "action_send_text", "condition_text_match", "action_send_media", "action_send_media", "action_send_text", "wait_duration", "action_send_media", "action_set_variable"],
  ["action_send_text", "action_send_media", "action_send_media", "action_send_media", "wait_duration", "condition_text_match", "action_send_media", "action_send_text", "action_http_request"],
  ["action_send_text", "action_send_media", "action_send_media", "wait_duration", "condition_text_match", "action_send_media", "action_send_text", "action_set_variable", "action_send_media"],
  ["action_send_text", "action_send_media", "action_set_variable", "action_send_media", "condition_text_match", "action_send_media", "wait_duration", "action_send_media", "action_http_request"],
  ["action_send_text", "action_send_media", "condition_text_match", "action_send_media", "action_send_media", "condition_text_match", "wait_duration", "action_send_text", "end"],
];

const MEDIA_KINDS: MediaKind[] = ["large", "large", "preview", "large", "video", "large", "link", "large", "preview", "large", "large", "preview", "large", "video", "large", "link", "large", "preview"];

export function largeFile(n: number): string {
  return `large-${n}.jpg`;
}

export function previewFile(n: number): string {
  return `preview-${n}.jpg`;
}

export const VIDEO_FILE = "clip.mp4";

function fixtureUrl(file: string): string {
  return `/fixtures/${file}`;
}

interface PlacedMedia {
  config: Record<string, unknown>;
  record: Media | null;
}

function mediaFor(slot: number): PlacedMedia {
  const kind = MEDIA_KINDS[slot];
  const id = `academia-midia-${slot + 1}`;
  const large = largeFile((slot % IMAGE_FIXTURE_SHAPE.largeImages) + 1);
  const caption = slot % 3 === 0 ? "Tabela de planos atualizada" : "";
  const record = (url: string, previewUrl: string, type: string): Media => ({ id, description: `material-${slot + 1}`, url, previewUrl, createdAt: "2026-10-01T00:00:00Z", type });
  switch (kind) {
    case "preview": {
      const preview = previewFile((slot % IMAGE_FIXTURE_SHAPE.previews) + 1);
      return { config: { media_id: id, _display_media_id: `tabela-${slot + 1}.jpg`, _media_preview_url: fixtureUrl(preview), _media_type: "image", caption }, record: record(fixtureUrl(large), fixtureUrl(preview), "image") };
    }
    case "link":
      return { config: { media_url: fixtureUrl(large), caption }, record: null };
    case "video":
      return { config: { media_id: id, _display_media_id: `tour-${slot + 1}.mp4`, caption }, record: record(fixtureUrl(VIDEO_FILE), "", "video") };
    default:
      return { config: { media_id: id, _display_media_id: `arte-${slot + 1}.jpg`, caption }, record: record(fixtureUrl(large), "", "image") };
  }
}

function configFor(type: WorkflowNodeType, index: number): Record<string, unknown> {
  switch (type) {
    case "action_send_text":
      return { text: `Oi {{lead.nome}}! Separei as informações da unidade ${index} para você.` };
    case "condition_text_match":
      return { display_name: `Escolha ${index}`, text: "{{trigger.mensagem}}", match_mode: "contains", cases: [{ value: `plano_${index}` }, { value: `horario_${index}` }] };
    case "action_http_request":
      return { display_name: `Agenda ${index}`, method: "GET", url: `https://api.example.test/agenda/${index}`, capture_variable: `agenda_${index}` };
    case "action_set_variable":
      return { variable: `etapa_${index}`, value: "{{trigger.mensagem}}" };
    case "wait_duration":
      return { seconds: 120 };
    default:
      return {};
  }
}

function mediaRecords(): Map<string, Media> {
  const records = new Map<string, Media>();
  for (let slot = 0; slot < IMAGE_FIXTURE_SHAPE.media; slot++) {
    const { record } = mediaFor(slot);
    if (record) records.set(record.id, record);
  }
  return records;
}

export const IMAGE_FIXTURE_MEDIA = mediaRecords();

export function imageFixtureWorkflow(): Workflow {
  let slot = 0;
  const rows = ROW_PLANS.map((plan, row) =>
    plan.map((type, column) => {
      const index = row * plan.length + column + 1;
      const config = type === "action_send_media" ? mediaFor(slot++).config : configFor(type, index);
      const node: WorkflowNode = { id: `m${index}`, type, position: { x: column * COLUMN_GAP, y: row * ROW_GAP }, config };
      return node;
    }),
  );
  const edges: WorkflowEdge[] = [];
  const link = (source: WorkflowNode, target: WorkflowNode, label?: string) => edges.push({ source: source.id, target: target.id, label });
  const menu = rows[0][2];
  rows.forEach((chain, row) => {
    chain.forEach((node, column) => {
      const next = chain[column + 1];
      if (!next || node.type === "end") return;
      if (node.type === "condition_text_match") {
        const cases = (node.config.cases as { value: string }[]).map((c) => c.value);
        link(node, next, cases[0]);
        link(node, rows[(row + 1) % ROWS][Math.min(column + 1, chain.length - 1)], cases[1]);
        if (node !== menu) link(node, menu, "default");
        return;
      }
      link(node, next);
    });
    if (row > 0) link(menu, chain[0]);
  });
  return {
    id: "perf-image-workflow",
    workspaceId: "perf-workspace",
    name: "Fluxo sintético com mídias",
    status: "draft",
    type: "messages",
    graph: { nodes: rows.flat(), edges },
    version: 1,
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
    entryPoints: [],
  };
}
