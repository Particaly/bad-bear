import { requestFormData, requestJson } from './httpClient'
import type {
  AuthResponse,
  CurrentUserResponse,
  LoginRequest,
  RegisterRequest,
  UpdateUsernameRequest,
} from '../types/auth'

export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return requestJson<AuthResponse, RegisterRequest>({
    path: '/api/v1/auth/register',
    method: 'POST',
    body: payload,
  })
}

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return requestJson<AuthResponse, LoginRequest>({
    path: '/api/v1/auth/login',
    method: 'POST',
    body: payload,
  })
}

export function getCurrentUser(): Promise<CurrentUserResponse> {
  return requestJson<CurrentUserResponse>({
    path: '/api/v1/auth/me',
  })
}

export function updateMyUsername(
  payload: UpdateUsernameRequest,
): Promise<CurrentUserResponse> {
  return requestJson<CurrentUserResponse, UpdateUsernameRequest>({
    path: '/api/v1/users/me/username',
    method: 'PATCH',
    body: payload,
  })
}

export function uploadMyAvatar(file: File): Promise<CurrentUserResponse> {
  const formData = new FormData()
  formData.append('avatar', file)

  return requestFormData<CurrentUserResponse>({
    path: '/api/v1/users/me/avatar',
    method: 'POST',
    body: formData,
  })
}
