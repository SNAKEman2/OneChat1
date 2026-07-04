/**
 * Section G — Authentication Abstraction Layer
 *
 * This module defines a provider-agnostic AuthProvider interface so that
 * OneChat can swap authentication providers (Replit → Google/GitHub/Auth0/Clerk/etc.)
 * without rewriting application code.
 *
 * HOW TO SWAP PROVIDERS:
 * 1. Create a new file implementing AuthProvider (e.g. google-auth-provider.ts)
 * 2. Change the `currentProvider` export below to use the new implementation
 * 3. The rest of the app continues to import from "@/lib/auth-provider"
 */

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthProvider {
  /** Returns the current auth state (user, loading, authenticated) */
  useAuthState(): AuthState;

  /** Initiates the sign-in flow (redirect or popup) */
  signIn(options?: { returnTo?: string }): void;

  /** Signs out the current user */
  signOut(): Promise<void>;

  /** Returns the URL to begin the login flow */
  getLoginUrl(returnTo?: string): string;

  /** Returns the URL to complete the logout flow */
  getLogoutUrl(): string;
}

// ─── Replit Auth Provider implementation ────────────────────────────────────

class ReplitAuthProvider implements AuthProvider {
  useAuthState(): AuthState {
    // Delegates to the existing useAuth hook from @workspace/replit-auth-web
    // This is resolved at the call site in hooks/use-auth-provider.ts to avoid
    // React hook rules violations (hooks can't be called from class methods directly)
    throw new Error("Call useAuthProviderState() hook instead");
  }

  signIn(options?: { returnTo?: string }) {
    const params = new URLSearchParams();
    if (options?.returnTo) params.set("returnTo", options.returnTo);
    window.location.href = `/api/login${params.size ? `?${params}` : ""}`;
  }

  async signOut() {
    window.location.href = "/api/logout";
  }

  getLoginUrl(returnTo?: string) {
    const params = new URLSearchParams();
    if (returnTo) params.set("returnTo", returnTo);
    return `/api/login${params.size ? `?${params}` : ""}`;
  }

  getLogoutUrl() {
    return "/api/logout";
  }
}

/**
 * The active provider. To switch providers:
 *   import { GoogleAuthProvider } from "./google-auth-provider";
 *   export const currentProvider: AuthProvider = new GoogleAuthProvider();
 */
export const currentProvider: AuthProvider = new ReplitAuthProvider();

// ─── React hook bridge ───────────────────────────────────────────────────────
// The actual useAuth() hook in use-auth-provider.ts delegates to the provider.
// This file stays provider-agnostic.

export type { ReplitAuthProvider };
