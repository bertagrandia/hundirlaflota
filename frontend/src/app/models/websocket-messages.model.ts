import { AttackResult, CellState, PlayerKey, ShipPlacement } from './game.model';

export interface PlaceShipsMessage {
  type: 'place_ships';
  ships: ShipPlacement[];
}

export interface AttackMessage {
  type: 'attack';
  row: number;
  col: number;
}

export interface RematchMessage {
  type: 'rematch';
}

export interface SurrenderMessage {
  type: 'surrender';
}

export type ClientMessage = PlaceShipsMessage | AttackMessage | RematchMessage | SurrenderMessage;

export interface WaitingPlacementMessage {
  type: 'waiting_placement';
}

export interface PlacementOkMessage {
  type: 'placement_ok';
}

export interface GameStartMessage {
  type: 'game_start';
  your_turn: boolean;
}

export interface AttackResultMessage {
  type: 'attack_result';
  row: number;
  col: number;
  result: AttackResult;
  ship_id: string | null;
  ship_cells: Array<[number, number]> | null;
  current_turn: PlayerKey;
}

export interface GameOverMessage {
  type: 'game_over';
  winner: PlayerKey;
  enemy_board: CellState[][];
}

export interface PlayerDisconnectedMessage {
  type: 'player_disconnected';
  username: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | WaitingPlacementMessage
  | PlacementOkMessage
  | GameStartMessage
  | AttackResultMessage
  | GameOverMessage
  | PlayerDisconnectedMessage
  | ErrorMessage;
