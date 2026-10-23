export interface VisionBudget {
  longEdge: number;
  pixels: number;
}

export const VISION_BUDGET: VisionBudget = { longEdge: 1568, pixels: 1_150_000 };

export interface SheetCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RowSheet {
  width: number;
  height: number;
  cells: SheetCell[];
}

function rowsAt(aspects: readonly number[], height: number, longEdge: number, gap: number): SheetCell[] {
  const cells: SheetCell[] = [];
  let x = 0;
  let y = 0;
  for (const aspect of aspects) {
    const width = Math.max(1, Math.round(height * aspect));
    if (x > 0 && x + width > longEdge) {
      x = 0;
      y += height + gap;
    }
    cells.push({ x, y, width, height });
    x += width + gap;
  }
  return cells;
}

const MIN_ROW_PX = 16;

export function rowSheet(aspects: readonly number[], budget: VisionBudget = VISION_BUDGET, gap = 0): RowSheet {
  const at = (height: number): RowSheet => {
    const cells = rowsAt(aspects, height, budget.longEdge, gap);
    return { width: Math.max(...cells.map((c) => c.x + c.width)), height: Math.max(...cells.map((c) => c.y + c.height)), cells };
  };
  const fits = (sheet: RowSheet) => sheet.width <= budget.longEdge && sheet.height <= budget.longEdge && sheet.width * sheet.height <= budget.pixels;
  let low = MIN_ROW_PX;
  let high = budget.longEdge;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(at(middle))) low = middle;
    else high = middle - 1;
  }
  return at(low);
}
