import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, Signal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { GameService } from '../services/game.service';
import { NicknameService } from '../services/nickname.service';

const POLL_INTERVAL_MS = 2000;

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent implements OnDestroy {
  readonly nickname: Signal<string | null>;
  readonly nicknameInput = signal('');
  readonly roomCodeInput = signal('');
  readonly createdCode = signal<string | null>(null);
  readonly waitingForOpponent = signal(false);
  readonly creating = signal(false);
  readonly joining = signal(false);
  readonly startingAi = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private pollSubscription: Subscription | null = null;

  constructor(
    private readonly gameService: GameService,
    private readonly nicknameService: NicknameService,
    private readonly router: Router,
  ) {
    this.nickname = this.nicknameService.username;
  }

  confirmNickname(): void {
    const name = this.nicknameInput().trim();
    if (name.length < 2) {
      this.errorMessage.set('El nombre debe tener al menos 2 caracteres');
      return;
    }
    this.errorMessage.set(null);
    this.nicknameService.setUsername(name);
  }

  changeNickname(): void {
    this.stopPolling();
    this.createdCode.set(null);
    this.waitingForOpponent.set(false);
    this.nicknameService.clear();
  }

  createRoom(): void {
    const username = this.nickname();
    if (!username) {
      return;
    }
    this.errorMessage.set(null);
    this.creating.set(true);
    this.gameService.createRoom(username).subscribe({
      next: (response) => {
        this.creating.set(false);
        this.createdCode.set(response.code);
        this.waitingForOpponent.set(true);
        this.startPolling(response.code);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        this.errorMessage.set(err.error?.detail ?? 'No se pudo crear la sala');
      },
    });
  }

  joinRoom(): void {
    const username = this.nickname();
    const code = this.roomCodeInput().trim().toUpperCase();
    if (!username || code.length !== 6) {
      this.errorMessage.set('Introduce un código de 6 caracteres');
      return;
    }
    this.errorMessage.set(null);
    this.joining.set(true);
    this.gameService.joinRoom(code, username).subscribe({
      next: () => {
        this.joining.set(false);
        this.router.navigate(['/game', code]);
      },
      error: (err: HttpErrorResponse) => {
        this.joining.set(false);
        this.errorMessage.set(err.error?.detail ?? 'No se pudo unir a la sala');
      },
    });
  }

  playVsAi(): void {
    const username = this.nickname();
    const code = this.createdCode();
    if (!username || !code) {
      return;
    }
    this.startVsAi(code, username);
  }

  playVsAiDirect(): void {
    const username = this.nickname();
    if (!username) {
      return;
    }
    this.errorMessage.set(null);
    this.startingAi.set(true);
    this.gameService.createRoom(username).subscribe({
      next: (response) => this.startVsAi(response.code, username),
      error: (err: HttpErrorResponse) => {
        this.startingAi.set(false);
        this.errorMessage.set(err.error?.detail ?? 'No se pudo crear la sala');
      },
    });
  }

  private startVsAi(code: string, username: string): void {
    this.startingAi.set(true);
    this.gameService.playVsAi(code, username).subscribe({
      next: () => {
        this.startingAi.set(false);
        this.stopPolling();
        this.router.navigate(['/game', code]);
      },
      error: (err: HttpErrorResponse) => {
        this.startingAi.set(false);
        this.errorMessage.set(err.error?.detail ?? 'No se pudo iniciar contra la IA');
      },
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(code: string): void {
    this.stopPolling();
    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.gameService.getRoom(code)))
      .subscribe({
        next: (room) => {
          if (room.status !== 'waiting') {
            this.stopPolling();
            this.router.navigate(['/game', code]);
          }
        },
        error: () => {
          this.stopPolling();
          this.errorMessage.set('La sala ha expirado, créala de nuevo');
          this.createdCode.set(null);
          this.waitingForOpponent.set(false);
        },
      });
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }
}
