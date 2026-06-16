import { Routes } from '@angular/router';

import { nicknameGuard } from './guards/nickname.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'lobby', pathMatch: 'full' },
  {
    path: 'lobby',
    loadComponent: () => import('./lobby/lobby.component').then((m) => m.LobbyComponent),
  },
  {
    path: 'game/:code',
    loadComponent: () => import('./game/game.component').then((m) => m.GameComponent),
    canActivate: [nicknameGuard],
  },
  { path: '**', redirectTo: 'lobby' },
];
