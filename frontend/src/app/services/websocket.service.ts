import { Injectable, signal } from '@angular/core';

import { environment } from '../../environments/environment';
import { ClientMessage, ServerMessage } from '../models';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1500;

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  readonly lastMessage = signal<ServerMessage | null>(null);
  readonly connectionStatus = signal<ConnectionStatus>('closed');

  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private manualClose = false;
  private currentRoomCode = '';
  private currentUsername = '';

  connect(roomCode: string, username: string): void {
    this.manualClose = false;
    this.reconnectAttempts = 0;
    this.currentRoomCode = roomCode;
    this.currentUsername = username;
    this.openSocket();
  }

  send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.manualClose = true;
    this.socket?.close();
    this.socket = null;
  }

  private openSocket(): void {
    this.connectionStatus.set('connecting');
    const url = `${environment.wsUrl}/ws/${this.currentRoomCode}?username=${encodeURIComponent(this.currentUsername)}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.connectionStatus.set('open');
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ServerMessage;
        this.lastMessage.set(data);
      } catch {
        return;
      }
    };

    this.socket.onerror = () => {
      this.connectionStatus.set('error');
    };

    this.socket.onclose = () => {
      this.connectionStatus.set('closed');
      if (!this.manualClose && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts += 1;
        setTimeout(() => this.openSocket(), RECONNECT_DELAY_MS);
      }
    };
  }
}
