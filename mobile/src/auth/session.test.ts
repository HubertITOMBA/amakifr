import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

vi.stubEnv("EXPO_PUBLIC_API_URL", "http://example.test:9052");

import {
  __resetRefreshFlightForTests,
  authenticatedBinaryFetch,
  authenticatedFetch,
  fetchApiResponse,
  isFormDataBody,
  logoutRequest,
  refreshSession,
} from "@/auth/session";
import {
  ACCESS_KEY,
  REFRESH_KEY,
  saveTokens,
  getRefreshToken,
  getAccessToken,
  clearTokens,
} from "@/auth/token-storage";
import { shouldClearTokensAfterRefreshError } from "@/auth/refresh-error-policy";
import { ApiClientError } from "@/api/types";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("shouldClearTokensAfterRefreshError", () => {
  it("401 / UNAUTHENTICATED → true", () => {
    expect(
      shouldClearTokensAfterRefreshError(
        new ApiClientError(401, "UNAUTHENTICATED", "x")
      )
    ).toBe(true);
  });

  it("403 / FORBIDDEN → true", () => {
    expect(
      shouldClearTokensAfterRefreshError(
        new ApiClientError(403, "FORBIDDEN", "inactif")
      )
    ).toBe(true);
  });

  it("NETWORK_ERROR → false", () => {
    expect(
      shouldClearTokensAfterRefreshError(
        new ApiClientError(0, "NETWORK_ERROR", "down")
      )
    ).toBe(false);
  });

  it("429 → false", () => {
    expect(
      shouldClearTokensAfterRefreshError(
        new ApiClientError(429, "RATE_LIMITED", "slow")
      )
    ).toBe(false);
  });

  it("500 → false", () => {
    expect(
      shouldClearTokensAfterRefreshError(
        new ApiClientError(500, "INTERNAL_ERROR", "boom")
      )
    ).toBe(false);
  });
});

describe("token-storage", () => {
  beforeEach(async () => {
    store.clear();
    __resetRefreshFlightForTests();
    vi.mocked(SecureStore.setItemAsync).mockClear();
  });

  it("save / get / clear", async () => {
    await saveTokens("access-1", "refresh-1");
    expect(await getRefreshToken()).toBe("refresh-1");
    await clearTokens();
    expect(await getRefreshToken()).toBeNull();
  });

  it("saveTokens écrit refresh AVANT access", async () => {
    await saveTokens("new-access", "new-refresh");
    const calls = vi.mocked(SecureStore.setItemAsync).mock.calls;
    expect(calls[0]).toEqual([REFRESH_KEY, "new-refresh"]);
    expect(calls[1]).toEqual([ACCESS_KEY, "new-access"]);
  });
});

describe("refresh single-flight + erreurs", () => {
  beforeEach(async () => {
    store.clear();
    __resetRefreshFlightForTests();
    vi.unstubAllGlobals();
    await saveTokens("old-access", "old-refresh");
  });

  it("deux 401 simultanés → un seul POST /auth/refresh", async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return jsonResponse(200, {
          success: true,
          data: {
            accessToken: "new-access",
            refreshToken: "new-refresh",
            accessTokenExpiresAt: "2030-01-01T00:00:00.000Z",
            refreshTokenExpiresAt: "2030-02-01T00:00:00.000Z",
            user: {
              id: "u1",
              name: "Ada",
              email: "a@b.com",
              role: "MEMBRE",
              status: "Actif",
            },
          },
        });
      }

      if (url.includes("/api/v1/me")) {
        const auth = (init?.headers as Record<string, string>)?.Authorization;
        if (auth === "Bearer old-access") {
          return jsonResponse(401, {
            success: false,
            error: { code: "UNAUTHENTICATED", message: "Non authentifié" },
          });
        }
        return jsonResponse(200, {
          success: true,
          data: {
            id: "u1",
            name: "Ada",
            email: "a@b.com",
            role: "MEMBRE",
            status: "Actif",
          },
        });
      }

      return new Response("{}", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      authenticatedFetch("/api/v1/me"),
      authenticatedFetch("/api/v1/me"),
    ]);

    expect(refreshCalls).toBe(1);
    expect(a).toMatchObject({ id: "u1" });
    expect(b).toMatchObject({ id: "u1" });
    expect(await getRefreshToken()).toBe("new-refresh");
  });

  it("refresh 401 → clearTokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(401, {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Session invalide" },
        })
      )
    );

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError);
    expect(await getRefreshToken()).toBeNull();
    expect(await getAccessToken()).toBeNull();
  });

  it("refresh 403 → clearTokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(403, {
          success: false,
          error: { code: "FORBIDDEN", message: "Compte désactivé" },
        })
      )
    );

    await expect(refreshSession()).rejects.toMatchObject({ status: 403 });
    expect(await getRefreshToken()).toBeNull();
  });

  it("refresh NETWORK_ERROR → tokens conservés", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await expect(refreshSession()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(await getRefreshToken()).toBe("old-refresh");
    expect(await getAccessToken()).toBe("old-access");
  });

  it("refresh 429 → tokens conservés", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(429, {
          success: false,
          error: { code: "RATE_LIMITED", message: "Trop de tentatives" },
        })
      )
    );

    await expect(refreshSession()).rejects.toMatchObject({ status: 429 });
    expect(await getRefreshToken()).toBe("old-refresh");
  });

  it("refresh 500 → tokens conservés", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(500, {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Erreur" },
        })
      )
    );

    await expect(refreshSession()).rejects.toMatchObject({ status: 500 });
    expect(await getRefreshToken()).toBe("old-refresh");
  });

  it("retry après refresh : une seule nouvelle tentative ; 2e 401 → clear", async () => {
    let meCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/refresh")) {
          return jsonResponse(200, {
            success: true,
            data: {
              accessToken: "new-access",
              refreshToken: "new-refresh",
              accessTokenExpiresAt: "2030-01-01T00:00:00.000Z",
              refreshTokenExpiresAt: "2030-02-01T00:00:00.000Z",
              user: {
                id: "u1",
                name: "Ada",
                email: "a@b.com",
                role: "MEMBRE",
                status: "Actif",
              },
            },
          });
        }
        if (url.includes("/api/v1/me")) {
          meCalls += 1;
          return jsonResponse(401, {
            success: false,
            error: { code: "UNAUTHENTICATED", message: "Non authentifié" },
          });
        }
        return new Response("{}", { status: 404 });
      })
    );

    await expect(authenticatedFetch("/api/v1/me")).rejects.toMatchObject({
      status: 401,
    });
    // 1er appel + 1 retry après refresh = 2
    expect(meCalls).toBe(2);
    expect(await getRefreshToken()).toBeNull();
  });
});

describe("authenticatedBinaryFetch", () => {
  beforeEach(async () => {
    store.clear();
    __resetRefreshFlightForTests();
    vi.unstubAllGlobals();
    await saveTokens("old-access", "old-refresh");
  });

  it("retourne ArrayBuffer sur succès PDF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        })
      )
    );

    const buf = await authenticatedBinaryFetch("/api/v1/me/passeport/pdf");
    expect(buf.byteLength).toBe(4);
  });

  it("401 → refresh puis retry binaire", async () => {
    let pdfCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/refresh")) {
          return jsonResponse(200, {
            success: true,
            data: {
              accessToken: "new-access",
              refreshToken: "new-refresh",
              accessTokenExpiresAt: "2030-01-01T00:00:00.000Z",
              refreshTokenExpiresAt: "2030-02-01T00:00:00.000Z",
              user: {
                id: "u1",
                name: "Ada",
                email: "a@b.com",
                role: "MEMBRE",
                status: "Actif",
              },
            },
          });
        }
        if (url.includes("/api/v1/me/passeport/pdf")) {
          pdfCalls += 1;
          const auth = (init?.headers as Record<string, string>)?.Authorization;
          if (auth === "Bearer old-access") {
            return jsonResponse(401, {
              success: false,
              error: { code: "UNAUTHENTICATED", message: "Non authentifié" },
            });
          }
          return new Response(new Uint8Array([37, 80, 68, 70]), {
            status: 200,
            headers: { "Content-Type": "application/pdf" },
          });
        }
        return new Response("{}", { status: 404 });
      })
    );

    const buf = await authenticatedBinaryFetch("/api/v1/me/passeport/pdf");
    expect(pdfCalls).toBe(2);
    expect(buf.byteLength).toBe(4);
  });
});

describe("logout", () => {
  beforeEach(async () => {
    store.clear();
    __resetRefreshFlightForTests();
    await saveTokens("a", "r");
  });

  it("clear local même si réseau échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await logoutRequest();
    expect(await getRefreshToken()).toBeNull();
  });
});

describe("fetchApiResponse FormData vs JSON", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("détecte FormData natif et duck-type RN (getParts)", () => {
    expect(isFormDataBody(new FormData())).toBe(true);
    expect(isFormDataBody({ foo: 1 })).toBe(false);
    expect(isFormDataBody(null)).toBe(false);
    const rnLike = {
      append: () => undefined,
      getParts: () => [],
    };
    expect(isFormDataBody(rnLike)).toBe(true);
  });

  it("body objet JS → JSON.stringify + application/json", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { success: true, data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchApiResponse("/api/v1/me/x", {
      method: "POST",
      body: { a: 1 },
      accessToken: "tok",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer tok");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("FormData → body brut, aucun Content-Type forcé, auth conservé", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { success: true, data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("targetType", "cotisation-mensuelle");
    form.append("amount", "10");

    await fetchApiResponse("/api/v1/me/payments/bank-transfer", {
      method: "POST",
      body: form,
      accessToken: "tok-2",
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer tok-2");
    expect(init.body).toBe(form);
    expect(init.method).toBe("POST");
  });

  it("duck-type RN FormData → pas de JSON.stringify", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { success: true, data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const rnForm = {
      append: vi.fn(),
      getParts: vi.fn(() => []),
    };

    await fetchApiResponse("/api/v1/me/payments/bank-transfer", {
      method: "POST",
      body: rnForm,
      accessToken: "t",
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(rnForm);
    expect(typeof init.body).not.toBe("string");
  });
});
