import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({ authenticatedFetch }));

import {
  buildMyPaymentsQuery,
  getMyCotisationLines,
  getMyCotisationYear,
  getMyCotisationsMensuelles,
  getMyPayments,
} from "@/api/cotisations";

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
    expect(authenticatedFetch.mock.calls[0][1]).toBeUndefined();
  });

  it("getMyCotisationYear sans historique dans le path", async () => {
    authenticatedFetch.mockResolvedValue({});
    await getMyCotisationYear(2026);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/cotisations/year?annee=2026"
    );
  });

  it("getMyPayments — query paginée sans id client", async () => {
    authenticatedFetch.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await getMyPayments({ annee: 2026, limit: 20, offset: 0 });
    const path = authenticatedFetch.mock.calls[0][0] as string;
    expect(path).toBe(
      "/api/v1/me/cotisations/payments?annee=2026&limit=20&offset=0"
    );
    expect(path).not.toContain("userId");
    expect(path).not.toContain("adherentId");
  });

  it("buildMyPaymentsQuery sans année = toutes", () => {
    expect(buildMyPaymentsQuery({ limit: 20, offset: 40 })).toBe(
      "?limit=20&offset=40"
    );
  });

  it("getMyCotisationLines — Toutes les années", async () => {
    authenticatedFetch.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      summary: {
        detteBrute: "0",
        avoirDisponible: "0",
        resteNet: "0",
        totalPayeAnnee: "0",
      },
    });
    await getMyCotisationLines({ limit: 20, offset: 0 });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/cotisations/lines?limit=20&offset=0"
    );
  });
});
