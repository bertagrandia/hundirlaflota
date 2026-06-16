import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';

import {
  AttackAnimation,
  BOARD_SIZE,
  BoardGrid,
  FLEET,
  Orientation,
  PlacedShip,
  ShipPlacement,
  ShotsGrid,
  WATER,
  createEmptyGrid,
  createEmptyShotsGrid,
} from '../../models';
import { buildOccupiedSet, canPlaceShip, computeShipCells, generateRandomFleet } from './board-placement.utils';

export type BoardPhase = 'placement' | 'playing';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent implements OnChanges {
  @Input({ required: true }) phase!: BoardPhase;
  @Input() ownGrid: BoardGrid = createEmptyGrid();
  @Input() ownShots: ShotsGrid = createEmptyShotsGrid();
  @Input() enemyGrid: BoardGrid = createEmptyGrid();
  @Input() enemyShots: ShotsGrid = createEmptyShotsGrid();
  @Input() isMyTurn = false;
  @Input() lastAttack: AttackAnimation | null = null;

  @Output() placementConfirmed = new EventEmitter<ShipPlacement[]>();
  @Output() attackCell = new EventEmitter<{ row: number; col: number }>();

  readonly rows = Array.from({ length: BOARD_SIZE }, (_, i) => i);
  readonly cols = Array.from({ length: BOARD_SIZE }, (_, i) => i);
  readonly fleetDefs = FLEET;

  readonly placedShips = signal<PlacedShip[]>([]);
  readonly selectedShipId = signal<string | null>(FLEET[0].id);
  readonly orientation = signal<Orientation>('horizontal');
  readonly hoverCell = signal<{ row: number; col: number } | null>(null);

  readonly allPlaced = computed(() => this.placedShips().length === this.fleetDefs.length);

  private readonly animatingCell = signal<{ row: number; col: number; target: 'own' | 'enemy' } | null>(null);
  private readonly animationClassSignal = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['phase'] && this.phase === 'placement') {
      this.placedShips.set([]);
      this.selectedShipId.set(this.fleetDefs[0]?.id ?? null);
      this.orientation.set('horizontal');
    }

    if (changes['lastAttack'] && this.lastAttack) {
      const { row, col, result, target } = this.lastAttack;
      this.animatingCell.set({ row, col, target });
      this.animationClassSignal.set(
        result === 'water' ? 'animate-splash' : result === 'hit' ? 'animate-explosion' : 'animate-sunk',
      );
      setTimeout(() => this.animatingCell.set(null), 700);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.phase === 'placement' && event.key.toLowerCase() === 'r') {
      this.toggleOrientation();
    }
  }

  isShipPlaced(id: string): boolean {
    return this.placedShips().some((s) => s.id === id);
  }

  selectShip(id: string): void {
    if (this.isShipPlaced(id)) {
      return;
    }
    this.selectedShipId.set(id);
  }

  removeShip(id: string, event: Event): void {
    event.stopPropagation();
    this.placedShips.update((ships) => ships.filter((s) => s.id !== id));
    this.selectedShipId.set(id);
  }

  toggleOrientation(): void {
    this.orientation.set(this.orientation() === 'horizontal' ? 'vertical' : 'horizontal');
  }

  previewCells(): Array<[number, number]> {
    const hover = this.hoverCell();
    const shipId = this.selectedShipId();
    if (!hover || !shipId || this.isShipPlaced(shipId)) {
      return [];
    }
    const def = this.fleetDefs.find((d) => d.id === shipId);
    if (!def) {
      return [];
    }
    return computeShipCells(hover.row, hover.col, def.size, this.orientation());
  }

  previewValid(): boolean {
    const cells = this.previewCells();
    if (cells.length === 0) {
      return false;
    }
    return canPlaceShip(cells, buildOccupiedSet(this.placedShips()));
  }

  isPreviewCell(row: number, col: number): boolean {
    return this.previewCells().some(([r, c]) => r === row && c === col);
  }

  isPlacedShipCell(row: number, col: number): boolean {
    return this.placedShips().some((s) => s.cells.some(([r, c]) => r === row && c === col));
  }

  onPlacementCellClick(row: number, col: number): void {
    const shipId = this.selectedShipId();
    if (!shipId || this.isShipPlaced(shipId)) {
      return;
    }
    const def = this.fleetDefs.find((d) => d.id === shipId);
    if (!def) {
      return;
    }
    const cells = computeShipCells(row, col, def.size, this.orientation());
    if (!canPlaceShip(cells, buildOccupiedSet(this.placedShips()))) {
      return;
    }

    this.placedShips.update((ships) => [
      ...ships,
      { ...def, cells, orientation: this.orientation(), sunk: false },
    ]);

    const next = this.fleetDefs.find((d) => d.id !== shipId && !this.isShipPlaced(d.id));
    this.selectedShipId.set(next ? next.id : null);
  }

  randomPlacement(): void {
    const fleet = generateRandomFleet();
    this.placedShips.set(
      fleet.map((f) => ({
        ...this.fleetDefs.find((d) => d.id === f.id)!,
        cells: f.cells,
        orientation: f.orientation,
        sunk: false,
      })),
    );
    this.selectedShipId.set(null);
  }

  confirmPlacement(): void {
    if (!this.allPlaced()) {
      return;
    }
    this.placementConfirmed.emit(this.placedShips().map((s) => ({ id: s.id, cells: s.cells })));
  }

  ownCellClass(row: number, col: number): Record<string, boolean> {
    const value = this.ownGrid[row][col];
    return {
      'board-cell--ship': value === 1,
      'board-cell--hit': value === 2,
      'board-cell--sunk': value === 3,
      'board-cell--miss': value === WATER && this.ownShots[row][col],
    };
  }

  enemyCellClass(row: number, col: number): Record<string, boolean> {
    const value = this.enemyGrid[row][col];
    return {
      'board-cell--hit': value === 2,
      'board-cell--sunk': value === 3,
      'board-cell--miss': value === WATER && this.enemyShots[row][col],
    };
  }

  canAttack(row: number, col: number): boolean {
    return (
      this.phase === 'playing' &&
      this.isMyTurn &&
      this.enemyGrid[row][col] !== 2 &&
      this.enemyGrid[row][col] !== 3 &&
      !this.enemyShots[row][col]
    );
  }

  onEnemyCellClick(row: number, col: number): void {
    if (!this.canAttack(row, col)) {
      return;
    }
    this.attackCell.emit({ row, col });
  }

  isAnimating(row: number, col: number, target: 'own' | 'enemy'): boolean {
    const a = this.animatingCell();
    return !!a && a.row === row && a.col === col && a.target === target;
  }

  animationClass(): string {
    return this.animationClassSignal();
  }
}
