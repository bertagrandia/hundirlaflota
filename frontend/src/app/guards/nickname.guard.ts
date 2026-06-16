import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { NicknameService } from '../services/nickname.service';

export const nicknameGuard: CanActivateFn = () => {
  const nicknameService = inject(NicknameService);
  const router = inject(Router);

  if (nicknameService.hasUsername()) {
    return true;
  }

  router.navigate(['/lobby']);
  return false;
};
