import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthUserDto, MeDto } from "@/api/types";
import { ApiClientError } from "@/api/types";
import {
  authenticatedFetch,
  loginRequest,
  logoutRequest,
  refreshSession,
} from "@/auth/session";
import { getAccessToken, getRefreshToken } from "@/auth/token-storage";
import { shouldClearTokensAfterRefreshError } from "@/auth/refresh-error-policy";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUserDto | MeDto | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider d'authentification mobile (SecureStore + /api/v1).
 *
 * `unauthenticated` (état UI) ≠ `clearTokens()` (persistance).
 * Erreurs réseau / 429 / 500 pendant restore : UI unauthenticated,
 * tokens conservés pour une prochaine tentative.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUserDto | MeDto | null>(null);

  const refreshMe = useCallback(async () => {
    const me = await authenticatedFetch<MeDto>("/api/v1/me");
    setUser(me);
    setStatus("authenticated");
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const refresh = await getRefreshToken();
      if (!refresh) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      const access = await getAccessToken();
      if (access) {
        // authenticatedFetch gère lui-même 401 + single-flight refresh
        await refreshMe();
        return;
      }

      // Refresh présent, access absent → rotation puis /me
      await refreshSession();
      await refreshMe();
    } catch (error) {
      // Ne clearTokens ici que si session définitivement invalide
      // (refreshSession l'a déjà fait le cas échéant).
      // Réseau/429/500 : conserver tokens, UI unauthenticated.
      if (
        error instanceof ApiClientError &&
        shouldClearTokensAfterRefreshError(error)
      ) {
        // déjà clear côté refreshSession si applicable
      }
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [refreshMe]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await loginRequest(email.trim(), password);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, refreshMe }),
    [status, user, signIn, signOut, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook auth — doit être sous AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }
  return ctx;
}
