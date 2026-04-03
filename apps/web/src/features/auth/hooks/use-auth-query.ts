import type { LoginRequest, RegisterRequest } from '@promptoon/shared';
import { useMutation } from '@tanstack/react-query';

import { authService } from '../../../shared/api/auth.service';

export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginRequest) => authService.login(payload)
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterRequest) => authService.register(payload)
  });
}
