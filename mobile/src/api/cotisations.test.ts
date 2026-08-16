import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({ authenticatedFetch }));

import { getMyCotisationsMensuelles } from "@/api/cotisations";

describe("cotisations API client", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("getMyCotisationsMensuelles GET path exact, sans id client", async () => {
    authenticatedFetch.mockResolvedValue([]);
    await getMyCotisationsMensuelles();
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/cotisations-mensuelles"
    );
    const path = authenticatedFetch.mock.calls[0][0] as string;
    expect(path).not.toContain("userId");
    expect(path).not.toContain("adherentId");
    // Pas d'options method → GET implicite authenticatedFetch
    expect(authenticatedFetch.mock.calls[0][1]).toBeUndefined();
  });
});
