export const BOARD_SIZE = 10;

export type CellState = 0 | 1 | 2 | 3;

export const WATER: CellState = 0;
export const SHIP: CellState = 1;
export const HIT: CellState = 2;
export const SUNK: CellState = 3;

export type AttackResult = 'water' | 'hit' | 'sunk';

export type Orientation = 'horizontal' | 'vertical';

export type PlayerKey = 'player1' | 'player2';

export interface ShipDefinition {
  id: string;
  size: number;
  label: string;
}

export const FLEET: ShipDefinition[] = [
  { id: 'carrier', size: 5, label: 'Portaaviones' },
  { id: 'battleship', size: 4, label: 'Acorazado' },
  { id: 'cruiser', size: 3, label: 'Crucero' },
  { id: 'submarine', size: 3, label: 'Submarino' },
  { id: 'destroyer', size: 2, label: 'Destructor' },
];

export interface ShipPlacement {
  id: string;
  cells: Array<[number, number]>;
}

export interface PlacedShip extends ShipDefinition {
  cells: Array<[number, number]>;
  orientation: Orientation;
  sunk: boolean;
}

export type BoardGrid = CellState[][];
export type ShotsGrid = boolean[][];

export function createEmptyGrid(): BoardGrid {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => WATER as CellState));
}

export function createEmptyShotsGrid(): ShotsGrid {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => false));
}

export interface AttackAnimation {
  row: number;
  col: number;
  result: AttackResult;
  target: 'own' | 'enemy';
}
