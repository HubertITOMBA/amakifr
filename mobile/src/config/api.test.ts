import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApiUrl, getApiBaseUrl } from "@/config/api";

describe("api config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://example.test:9052");
  });

  it("getApiBaseUrl retire le slash final", () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://192.168.1.126:9052/");
    expect(getApiBaseUrl()).toBe("http://192.168.1.126:9052");
  });

  it("buildApiUrl sans double slash", () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://192.168.1.126:9052/");
    expect(buildApiUrl("/api/v1/auth/login")).toBe(
      "http://192.168.1.126:9052/api/v1/auth/login"
    );
  });
});
