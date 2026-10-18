import { emptyArtboard, imageDocument, type ImageDocument } from "../../document";
import { parseDocument } from "../../validate";
import { planBatch, parseOperations } from "../batch";
import { imageDesignChecks } from "../design-check";
import { applyImageOperation, IMAGE_ID_FIELDS, IMAGE_OPERATIONS, imageIds, type ImageOpContext, type ImageOperation } from "../image-ops";
import { imageMarkTargets } from "../marks";
import { guideReport, type AngleGroup } from "../look-views";

const EVAL_ARTBOARD_ID = "ab-1";
const EVAL_ARTBOARD = { width: 1080, height: 1350 };
const FAKE_ID_SUFFIX = "-eval";

interface BriefGrade {
  ok: boolean;
  failures: string[];
  ignored: string[];
  errors: string[];
  warnings: string[];
  layers: number;
  paths: number;
  angles: AngleGroup[];
  angleNotes: string[];
  document: ImageDocument;
}

function evalDocument(): ImageDocument {
  return imageDocument([{ ...emptyArtboard(EVAL_ARTBOARD), id: EVAL_ARTBOARD_ID, name: "Arte" }]);
}

function withRealIds(batch: unknown, ids: ReadonlyMap<string, string>): unknown {
  let text = JSON.stringify(batch);
  for (const [fake, real] of ids) text = text.split(JSON.stringify(fake)).join(JSON.stringify(real));
  return JSON.parse(text);
}

export function gradeBriefRun(batches: readonly unknown[], icons: readonly string[] = []): BriefGrade {
  const context: ImageOpContext = { naturalSize: () => undefined, icons, activeArtboard: EVAL_ARTBOARD_ID };
  const failures: string[] = [];
  const ignored: string[] = [];
  const ids = new Map<string, string>();
  let document = evalDocument();
  batches.forEach((raw, index) => {
    const parsed = parseOperations<ImageOperation>(withRealIds(raw, ids), IMAGE_OPERATIONS);
    if (!parsed.ok) {
      failures.push(`lote ${index + 1}: ${parsed.reason}`);
      return;
    }
    const plan = planBatch(document, parsed.operations, (doc, op) => applyImageOperation(doc, op, context), IMAGE_ID_FIELDS, imageIds);
    if (!plan.ok) {
      failures.push(`lote ${index + 1}: ${plan.op}: ${plan.reason}`);
      return;
    }
    if (!parseDocument("image", plan.final).ok) {
      failures.push(`lote ${index + 1}: o documento resultante é inválido`);
      return;
    }
    for (const [ref, created] of Object.entries(plan.created)) if (created[0]) ids.set(`${ref}${FAKE_ID_SUFFIX}`, created[0]);
    ignored.push(...plan.notes);
    document = plan.final;
  });
  const artboard = document.artboards[0];
  const checks = imageDesignChecks(artboard);
  const guides = guideReport(imageMarkTargets(artboard), artboard.canvas);
  return {
    ok: failures.length === 0,
    failures,
    ignored,
    errors: checks.filter((line) => line.startsWith("erro")),
    warnings: checks.filter((line) => line.startsWith("aviso")),
    layers: artboard.layers.length,
    paths: artboard.layers.filter((layer) => layer.type === "shape" && layer.shape === "path").length,
    angles: guides.angles,
    angleNotes: guides.notes,
    document,
  };
}
