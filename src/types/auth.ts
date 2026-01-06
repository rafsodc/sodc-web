import { type User } from "firebase/auth";

/**
 * Authentication state
 */
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom claims from Firebase Auth token
 */
export interface CustomClaims {
  admin?: boolean;
  enabled?: boolean;
  [key: string]: any;
}

