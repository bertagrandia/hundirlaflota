import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { FLEET } from '../../models';

@Component({
  selector: 'app-game-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-status.component.html',
  styleUrl: './game-status.component.scss',
})
export class GameStatusComponent {
  @Input({ required: true }) isMyTurn!: boolean;
  @Input({ required: true }) ownShipsRemaining!: number;
  @Input({ required: true }) enemyShipsRemaining!: number;
  @Input() opponentName = 'Rival';

  readonly totalShips = FLEET.length;
}
