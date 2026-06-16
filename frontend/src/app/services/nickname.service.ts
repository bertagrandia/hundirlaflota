import { Injectable, signal } from '@angular/core';

const NICKNAME_KEY = 'battleship_username';

@Injectable({ providedIn: 'root' })
export class NicknameService {
  readonly username = signal<string | null>(localStorage.getItem(NICKNAME_KEY));

  setUsername(name: string): void {
    const trimmed = name.trim();
    localStorage.setItem(NICKNAME_KEY, trimmed);
    this.username.set(trimmed);
  }

  clear(): void {
    localStorage.removeItem(NICKNAME_KEY);
    this.username.set(null);
  }

  hasUsername(): boolean {
    return !!this.username();
  }
}
