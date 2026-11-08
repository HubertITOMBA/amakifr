import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contrats client réunions (participation / retrait).
 *
 * Limites : environnement Vitest `node` — pas de rendu React Native,
 * pas d’ActivityIndicator, ni de Pressable. Le chaînage UI
 * (onParticipationSuccess uniquement après await réussi, bouton masqué
 * si !canUpdateParticipation / !hasAnswer, état submitting) reste à
 * valider sur device / Expo. Ici : paths HTTP, payload et propagation
 * d’erreur pour empêcher une mise à jour locale sur rejet.
 */

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({
  authenticatedFetch,
}));

import {
  clearMyReunionParticipation,
  updateMyReunionParticipation,
} from "@/api/reunions";
import { ApiClientError } from "@/api/types";

describe("clearMyReunionParticipation", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("DELETE succès — path encodé, pas de body, contrat cleared", async () => {
    authenticatedFetch.mockResolvedValue({
      participationStatus: null,
      cleared: true,
      alreadyClear: false,
    });

    const result = await clearMyReunionParticipation("réu/1");

    expect(result).toEqual({
      participationStatus: null,
      cleared: true,
      alreadyClear: false,
    });
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/reunions/r%C3%A9u%2F1/participation",
      { method: "DELETE" }
    );
    const opts = authenticatedFetch.mock.calls[0][1] as Record<string, unknown>;
    expect(opts).not.toHaveProperty("body");
  });

  it("DELETE alreadyClear — même contrat, appelant peut appliquer null", async () => {
    authenticatedFetch.mockResolvedValue({
      participationStatus: null,
      cleared: true,
      alreadyClear: true,
    });

    const result = await clearMyReunionParticipation("r1");
    expect(result.alreadyClear).toBe(true);
    expect(result.participationStatus).toBeNull();
  });

  it("échec 403 — rejette ; aucun succès à appliquer localement", async () => {
    const err = new ApiClientError(
      403,
      "FORBIDDEN",
      "Participation non modifiable"
    );
    authenticatedFetch.mockRejectedValue(err);

    let localStatus: string | null = "Present";
    await expect(
      clearMyReunionParticipation("r-locked").then((res) => {
        // Mimique le contrat UI : succès seulement → onParticipationSuccess(..., null)
        localStatus = res.participationStatus;
      })
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    expect(localStatus).toBe("Present");
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/reunions/r-locked/participation",
      { method: "DELETE" }
    );
  });

  it("échec réseau — rejette sans payload de succès", async () => {
    authenticatedFetch.mockRejectedValue(
      new ApiClientError(0, "NETWORK_ERROR", "offline")
    );

    await expect(clearMyReunionParticipation("r1")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });
});

describe("updateMyReunionParticipation (contrat voisin)", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("PATCH succès — body statut", async () => {
    authenticatedFetch.mockResolvedValue({
      statut: "Absent",
    });

    const result = await updateMyReunionParticipation("r1", {
      statut: "Absent",
    });

    expect(result.statut).toBe("Absent");
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/reunions/r1/participation",
      { method: "PATCH", body: { statut: "Absent" } }
    );
  });
});
