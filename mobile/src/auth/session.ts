import { getApiBaseUrl } from "@/config/api";
import {
  ApiClientError,
  type ApiResponse,
  type MobileAuthSessionDto,
} from "@/api/types";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "@/auth/token-storage";
import { shouldClearTokensAfterRefreshError } from "@/auth/refresh-error-policy";

type FetchOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
  /** Si true, ne tente pas de refresh sur 401 */
  skipAuthRetry?: boolean;
};

let refreshPromise: Promise<MobileAuthSessionDto> | null = null;

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiClientError(
      response.status,
      "INTERNAL_ERROR",
      "Réponse serveur invalide"
    );
  }
}

/**
 * Appel HTTP bas niveau vers /api/v1 (sans retry auth).
 */
export async function apiRequest<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = options.accessToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(
      0,
      "NETWORK_ERROR",
      "Serveur injoignable. Vérifiez EXPO_PUBLIC_API_URL et le réseau."
    );
  }

  const json = (await parseJson(response)) as ApiResponse<T> | null;

  if (!response.ok || !json || json.success === false) {
    const code =
      json && "error" in json && json.error?.code
        ? json.error.code
        : "INTERNAL_ERROR";
    const message =
      json && "error" in json && json.error?.message
        ? json.error.message
        : `Erreur HTTP ${response.status}`;
    throw new ApiClientError(response.status, code, message);
  }

  return json.data as T;
}

/**
 * Login credentials — ne stocke rien en cas d'échec.
 */
export async function loginRequest(
  email: string,
  password: string
): Promise<MobileAuthSessionDto> {
  const session = await apiRequest<MobileAuthSessionDto>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
    skipAuthRetry: true,
  });
  await saveTokens(session.accessToken, session.refreshToken);
  return session;
}

/**
 * Rotation refresh — single-flight obligatoire (backend rotatif).
 * clearTokens uniquement si session définitivement invalide (401/403).
 */
export async function refreshSession(): Promise<MobileAuthSessionDto> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      await clearTokens();
      throw new ApiClientError(401, "UNAUTHENTICATED", "Session expirée");
    }

    try {
      const session = await apiRequest<MobileAuthSessionDto>(
        "/api/v1/auth/refresh",
        {
          method: "POST",
          body: { refreshToken },
          skipAuthRetry: true,
        }
      );
      await saveTokens(session.accessToken, session.refreshToken);
      return session;
    } catch (error) {
      if (shouldClearTokensAfterRefreshError(error)) {
        await clearTokens();
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Exposé pour tests : indique si un refresh est en cours. */
export function isRefreshInFlight(): boolean {
  return refreshPromise != null;
}

/** Reset test-only. */
export function __resetRefreshFlightForTests(): void {
  refreshPromise = null;
}

/**
 * Fetch authentifié avec retry unique après refresh sur 401.
 * Pas de refresh sur 403 / 429 / 500.
 * Si refresh échoue (réseau/429/500) : propage sans second refresh.
 */
export async function authenticatedFetch<T>(
  path: string,
  options: Omit<FetchOptions, "accessToken" | "skipAuthRetry"> = {}
): Promise<T> {
  const access = await getAccessToken();
  try {
    return await apiRequest<T>(path, {
      ...options,
      accessToken: access,
    });
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) {
      throw error;
    }

    // Uniquement 401 — pas 403/429/etc.
    await refreshSession();
    const newAccess = await getAccessToken();
    try {
      return await apiRequest<T>(path, {
        ...options,
        accessToken: newAccess,
        skipAuthRetry: true,
      });
    } catch (retryError) {
      if (
        retryError instanceof ApiClientError &&
        retryError.status === 401
      ) {
        await clearTokens();
      }
      throw retryError;
    }
  }
}

/**
 * Logout serveur best-effort puis clear local toujours.
 */
export async function logoutRequest(): Promise<void> {
  const refreshToken = await getRefreshToken();
  const accessToken = await getAccessToken();

  try {
    if (refreshToken || accessToken) {
      await apiRequest("/api/v1/auth/logout", {
        method: "POST",
        body: refreshToken ? { refreshToken } : {},
        accessToken: accessToken,
        skipAuthRetry: true,
      });
    }
  } catch {
    // Réseau absent : on continue le clear local
  } finally {
    await clearTokens();
  }
}
