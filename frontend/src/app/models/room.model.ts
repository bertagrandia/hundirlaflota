export type RoomStatus = 'waiting' | 'placement' | 'playing' | 'finished';

export interface RoomCreateResponse {
  code: string;
  status: RoomStatus;
  player1: string;
}

export interface RoomJoinResponse {
  code: string;
  status: RoomStatus;
  player1: string;
  player2: string | null;
}

export interface RoomStateResponse {
  code: string;
  status: RoomStatus;
  player1: string | null;
  player2: string | null;
  vs_ai: boolean;
}
