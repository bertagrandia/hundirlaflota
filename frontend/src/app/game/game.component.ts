import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { BoardComponent } from './board/board.component';
import { GameStatusComponent } from './game-status/game-status.component';
import {
  AttackAnimation,
  BoardGrid,
  FLEET,
  HIT,
  PlayerKey,
  ShipPlacement,
  ShotsGrid,
  SUNK,
  ServerMessage,
  SHIP,
  createEmptyGrid,
  createEmptyShotsGrid,
} from '../models';
import { GameService } from '../services/game.service';
import { NicknameService } from '../services/nickname.service';
import { WebsocketService } from '../services/websocket.service';

function cloneGrid(grid: BoardGrid): BoardGrid {
  return grid.map((row) => [...row]);
}

function markShot(shots: ShotsGrid, row: number, col: number): ShotsGrid {
  const next = shots.map((row2) => [...row2]);
  next[row][col] = true;
  return next;
}

function buildGridFromShips(ships: ShipPlacement[]): BoardGrid {
  const grid = createEmptyGrid();
  for (const ship of ships) {
    for (const [r, c] of ship.cells) {
      grid[r][c] = SHIP;
    }
  }
  return grid;
}

type GamePhase = 'placement' | 'playing' | 'finished';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, BoardComponent, GameStatusComponent],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit, OnDestroy {
  code = '';
  private username = '';

  readonly phase = signal<GamePhase>('placement');
  readonly myKey = signal<PlayerKey | null>(null);
  readonly opponentName = signal('Rival');

  readonly ownGrid = signal<BoardGrid>(createEmptyGrid());
  readonly ownShots = signal<ShotsGrid>(createEmptyShotsGrid());
  readonly enemyGrid = signal<BoardGrid>(createEmptyGrid());
  readonly enemyShots = signal<ShotsGrid>(createEmptyShotsGrid());
  readonly isMyTurn = signal(false);
  readonly lastAttack = signal<AttackAnimation | null>(null);

  readonly placementSubmitted = signal(false);
  readonly myShips = signal<ShipPlacement[]>([]);

  readonly ownSunkShipIds = signal<Set<string>>(new Set());
  readonly enemySunkShipIds = signal<Set<string>>(new Set());
  readonly ownShipsRemaining = computed(() => FLEET.length - this.ownSunkShipIds().size);
  readonly enemyShipsRemaining = computed(() => FLEET.length - this.enemySunkShipIds().size);

  readonly finished = signal(false);
  readonly winnerKey = signal<PlayerKey | null>(null);
  readonly iWon = computed(() => this.finished() && this.winnerKey() === this.myKey());

  readonly opponentDisconnected = signal(false);
  readonly rematchRequested = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly gameService: GameService,
    private readonly nicknameService: NicknameService,
    readonly websocketService: WebsocketService,
  ) {
    effect(
      () => {
        const message = this.websocketService.lastMessage();
        if (message) {
          this.handleServerMessage(message);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    const username = this.nicknameService.username();

    if (!this.code || !username) {
      this.router.navigate(['/lobby']);
      return;
    }
    this.username = username;

    this.gameService.getRoom(this.code).subscribe({
      next: (room) => {
        const opponent = room.player1 === this.username ? room.player2 : room.player1;
        this.opponentName.set(room.vs_ai ? 'IA' : opponent ?? 'Rival');
      },
      error: () => {
        this.errorMessage.set('La sala no existe o ha expirado');
      },
    });

    this.websocketService.connect(this.code, this.username);
  }

  ngOnDestroy(): void {
    this.websocketService.disconnect();
  }

  onPlacementConfirmed(ships: ShipPlacement[]): void {
    this.myShips.set(ships);
    this.ownGrid.set(buildGridFromShips(ships));
    this.placementSubmitted.set(true);
    this.websocketService.send({ type: 'place_ships', ships });
  }

  onAttackCell(coords: { row: number; col: number }): void {
    this.websocketService.send({ type: 'attack', row: coords.row, col: coords.col });
  }

  requestRematch(): void {
    this.rematchRequested.set(true);
    this.websocketService.send({ type: 'rematch' });
  }

  surrender(): void {
    this.websocketService.send({ type: 'surrender' });
  }

  backToLobby(): void {
    this.websocketService.disconnect();
    this.router.navigate(['/lobby']);
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'waiting_placement':
        if (this.phase() === 'finished') {
          this.resetForRematch();
        } else {
          this.placementSubmitted.set(true);
        }
        break;

      case 'placement_ok':
        this.placementSubmitted.set(true);
        break;

      case 'game_start':
        this.myKey.set(message.your_turn ? 'player1' : 'player2');
        this.isMyTurn.set(message.your_turn);
        this.phase.set('playing');
        break;

      case 'attack_result': {
        const { row, col, result, ship_id, ship_cells, current_turn } = message;
        const attackerKey: PlayerKey = current_turn === 'player1' ? 'player2' : 'player1';
        const iAttacked = attackerKey === this.myKey();
        const gridSignal = iAttacked ? this.enemyGrid : this.ownGrid;
        const shotsSignal = iAttacked ? this.enemyShots : this.ownShots;
        const sunkIdsSignal = iAttacked ? this.enemySunkShipIds : this.ownSunkShipIds;

        gridSignal.update((grid) => {
          const next = cloneGrid(grid);
          if (result === 'sunk' && ship_cells) {
            for (const [r, c] of ship_cells) {
              next[r][c] = SUNK;
            }
          } else if (result === 'hit') {
            next[row][col] = HIT;
          }
          return next;
        });
        shotsSignal.update((shots) => markShot(shots, row, col));

        if (result === 'sunk' && ship_id) {
          sunkIdsSignal.update((ids) => new Set(ids).add(ship_id));
        }

        this.lastAttack.set({ row, col, result, target: iAttacked ? 'enemy' : 'own' });
        this.isMyTurn.set(current_turn === this.myKey());
        break;
      }

      case 'game_over': {
        this.phase.set('finished');
        this.finished.set(true);
        this.winnerKey.set(message.winner);
        if (message.winner === this.myKey()) {
          this.enemyGrid.set(message.enemy_board);
        } else {
          this.ownGrid.set(message.enemy_board);
        }
        break;
      }

      case 'player_disconnected':
        this.opponentDisconnected.set(true);
        break;

      case 'error':
        this.errorMessage.set(message.message);
        setTimeout(() => this.errorMessage.set(null), 4000);
        break;
    }
  }

  private resetForRematch(): void {
    this.phase.set('placement');
    this.placementSubmitted.set(false);
    this.myShips.set([]);
    this.ownGrid.set(createEmptyGrid());
    this.enemyGrid.set(createEmptyGrid());
    this.ownShots.set(createEmptyShotsGrid());
    this.enemyShots.set(createEmptyShotsGrid());
    this.ownSunkShipIds.set(new Set());
    this.enemySunkShipIds.set(new Set());
    this.finished.set(false);
    this.winnerKey.set(null);
    this.isMyTurn.set(false);
    this.rematchRequested.set(false);
    this.lastAttack.set(null);
  }
}
