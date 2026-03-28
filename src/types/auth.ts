export interface AuthUser {
  id: string
  account: string
  username: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface LoginRequest {
  account: string
  password: string
}

export interface RegisterRequest {
  account: string
  username: string
  password: string
}

export interface CurrentUserResponse {
  user: AuthUser
}

export interface UpdateUsernameRequest {
  username: string
}
