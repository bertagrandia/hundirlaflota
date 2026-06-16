import { BOARD_SIZE, FLEET, Orientation } from '../../models';

export function computeShipCells(
  row: number,
  col: number,
  size: number,
  orientation: Orientation,
): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    cells.push([r, c]);
  }
  return cells;
}

export function isWithinBounds(cells: Array<[number, number]>): boolean {
  return cells.every(([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE);
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function overlaps(cells: Array<[number, number]>, occupied: Set<string>): boolean {
  return cells.some(([r, c]) => occupied.has(cellKey(r, c)));
}

export function touchesOccupied(cells: Array<[number, number]>, occupied: Set<string>): boolean {
  return cells.some(([r, c]) => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (occupied.has(cellKey(r + dr, c + dc))) {
          return true;
        }
      }
    }
    return false;
  });
}

export function canPlaceShip(cells: Array<[number, number]>, occupied: Set<string>): boolean {
  return isWithinBounds(cells) && !overlaps(cells, occupied) && !touchesOccupied(cells, occupied);
}

export function buildOccupiedSet(ships: Array<{ cells: Array<[number, number]> }>): Set<string> {
  const set = new Set<string>();
  for (const ship of ships) {
    for (const [r, c] of ship.cells) {
      set.add(cellKey(r, c));
    }
  }
  return set;
}

export interface RandomShipPlacement {
  id: string;
  size: number;
  cells: Array<[number, number]>;
  orientation: Orientation;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomFleet(): RandomShipPlacement[] {
  const occupied = new Set<string>();
  const result: RandomShipPlacement[] = [];

  for (const def of FLEET) {
    let placedCells: Array<[number, number]> | null = null;
    let placedOrientation: Orientation = 'horizontal';

    while (!placedCells) {
      const orientation: Orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      const row = orientation === 'vertical' ? randomInt(0, BOARD_SIZE - def.size) : randomInt(0, BOARD_SIZE - 1);
      const col = orientation === 'horizontal' ? randomInt(0, BOARD_SIZE - def.size) : randomInt(0, BOARD_SIZE - 1);
      const cells = computeShipCells(row, col, def.size, orientation);

      if (!overlaps(cells, occupied) && !touchesOccupied(cells, occupied)) {
        cells.forEach(([r, c]) => occupied.add(cellKey(r, c)));
        placedCells = cells;
        placedOrientation = orientation;
      }
    }

    result.push({ id: def.id, size: def.size, cells: placedCells, orientation: placedOrientation });
  }

  return result;
}
