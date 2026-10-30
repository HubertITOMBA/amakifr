import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const { auth, isRappelDetteGelMutationEnabled, poseRappelDetteGel } =
  vi.hoisted(() => ({
    auth: vi.fn(),
    isRappelDetteGelMutationEnabled: vi.fn(),
    poseRappelDetteGel: vi.fn(),
  }));

vi.mock("@/auth", () => ({ auth }));

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutation-activation",
  () => ({
    isRappelDetteGelMutationEnabled,
    RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE:
      "La pose et la levée de gels de rappel ne sont pas activées sur ce serveur.",
    RAPPEL_DETTE_GEL_MUTATION_ENABLED: false,
  })
);

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutate",
  () => ({
    poseRappelDetteGel,
  })
);

import { poseRappelDetteGelAction } from "@/actions/cotisations/pose-rappel-dette-gel";

describe("poseRappelDetteGelAction", () => {
  beforeEach(() => {
    auth.mockReset();
    isRappelDetteGelMutationEnabled.mockReset();
    poseRappelDetteGel.mockReset();
    isRappelDetteGelMutationEnabled.mockReturnValue(true);
  });

  it("refuse session absente", async () => {
    auth.mockResolvedValue(null);
    const r = await poseRappelDetteGelAction({
      scope: "ADHERENT",
      adherentId: "adh-1",
      motifCode: "AUTRE",
      motifTexte: "x",
    });
    expect(r).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
    });
    expect(poseRappelDetteGel).not.toHaveBeenCalled();
  });

  it("rôle refusé avant métier", async () => {
    auth.mockResolvedValue({
      user: { id: "u1", role: UserRole.TRESOR },
    });
    const r = await poseRappelDetteGelAction({
      scope: "ADHERENT",
      adherentId: "adh-1",
      motifCode: "AUTRE",
      motifTexte: "x",
    });
    expect(r).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(poseRappelDetteGel).not.toHaveBeenCalled();
  });

  it("flag mutation off → pas d’appel service", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    isRappelDetteGelMutationEnabled.mockReturnValue(false);
    const r = await poseRappelDetteGelAction({
      scope: "ADHERENT",
      adherentId: "adh-1",
      motifCode: "AUTRE",
      motifTexte: "x",
    });
    expect(r).toMatchObject({
      success: false,
      code: "GEL_MUTATION_DISABLED",
    });
    expect(poseRappelDetteGel).not.toHaveBeenCalled();
  });

  it("Zod strict refuse actor / flag client", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    const r = await poseRappelDetteGelAction({
      scope: "ADHERENT",
      adherentId: "adh-1",
      motifCode: "AUTRE",
      motifTexte: "x",
      actor: { userId: "evil" },
      isMutationEnabled: true,
      poseParUserId: "evil",
    });
    expect(r).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(poseRappelDetteGel).not.toHaveBeenCalled();
  });

  it("cible LIGNE exclusive invalide", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    const r = await poseRappelDetteGelAction({
      scope: "LIGNE",
      adherentId: "adh-1",
      lineSource: "cotisation_mensuelle",
      cotisationMensuelleId: "cm-1",
      detteInitialeId: "di-1",
      motifCode: "AUTRE",
      motifTexte: "x",
    });
    expect(r).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("succès posed — actor issu de la session", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-session", role: UserRole.ADMIN },
    });
    poseRappelDetteGel.mockResolvedValue({
      ok: true,
      outcome: "posed",
      gelId: "gel-1",
      adherentId: "adh-1",
      scope: "ADHERENT",
      statut: "ACTIF",
      gelsRevision: "1",
    });
    const r = await poseRappelDetteGelAction({
      scope: "ADHERENT",
      adherentId: "adh-1",
      motifCode: "CONTESTATION",
      motifTexte: "ok",
    });
    expect(r).toMatchObject({
      success: true,
      data: { outcome: "posed", gelId: "gel-1", gelsRevision: "1" },
    });
    expect(poseRappelDetteGel).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: "admin-session", role: UserRole.ADMIN },
      })
    );
  });
});
