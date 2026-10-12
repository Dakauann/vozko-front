export type CellGrid = string[][];

export function delimiterOf(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseDelimited(text: string, delimiter: string = delimiterOf(text)): CellGrid {
  const rows: CellGrid = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export interface GridCell {
  row: number;
  column: number;
}

function sized(grid: CellGrid, rows: number, columns: number): CellGrid {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => grid[r]?.[c] ?? ""));
}

export function gridColumns(grid: CellGrid): number {
  return Math.max(1, ...grid.map((row) => row.length));
}

export function pasteCells(grid: CellGrid, at: GridCell, cells: CellGrid): CellGrid {
  const rows = Math.max(grid.length, at.row + cells.length);
  const columns = Math.max(gridColumns(grid), at.column + Math.max(0, ...cells.map((row) => row.length)));
  const next = sized(grid, rows, columns);
  cells.forEach((line, r) => line.forEach((value, c) => (next[at.row + r][at.column + c] = value)));
  return next;
}

export function setCell(grid: CellGrid, at: GridCell, value: string): CellGrid {
  return pasteCells(grid, at, [[value]]);
}

export function insertRow(grid: CellGrid, index: number): CellGrid {
  const columns = gridColumns(grid);
  return [...grid.slice(0, index), Array.from({ length: columns }, () => ""), ...grid.slice(index)];
}

export function removeRow(grid: CellGrid, index: number, frozen: number = 1): CellGrid {
  return index < frozen || grid.length <= frozen + 1 ? grid : grid.filter((_, r) => r !== index);
}

export function insertColumn(grid: CellGrid, index: number): CellGrid {
  const columns = gridColumns(grid);
  return sized(grid, grid.length, columns).map((row) => [...row.slice(0, index), "", ...row.slice(index)]);
}

export function removeColumn(grid: CellGrid, index: number, frozen: number = 1): CellGrid {
  const columns = gridColumns(grid);
  return index < frozen || columns <= frozen + 1 ? grid : sized(grid, grid.length, columns).map((row) => row.filter((_, c) => c !== index));
}
