import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const { auth, isRappelDetteGelMutationEnabled, leveRappelDetteGel } =
  vi.hoisted(() => ({
    auth: vi.fn(),
    isRappelDetteGelMutationEnabled: vi.fn(),
    leveRappelDetteGel: vi.fn(),
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
    leveRappelDetteGel,
  })
);

import { leveRappelDetteGelAction } from "@/actions/cotisations/leve-rappel-dette-gel";

describe("leveRappelDetteGelAction", () => {
  beforeEach(() => {
    auth.mockReset();
    isRappelDetteGelMutationEnabled.mockReset();
    leveRappelDetteGel.mockReset();
    isRappelDetteGelMutationEnabled.mockReturnValue(true);
  });

  it("refuse session absente", async () => {
    auth.mockResolvedValue(null);
    const r = await leveRappelDetteGelAction({
      adherentId: "adh-1",
      gelId: "gel-1",
    });
    expect(r).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
    });
  });

  it("flag mutation off", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    isRappelDetteGelMutationEnabled.mockReturnValue(false);
    const r = await leveRappelDetteGelAction({
      adherentId: "adh-1",
      gelId: "gel-1",
    });
    expect(r).toMatchObject({
      success: false,
      code: "GEL_MUTATION_DISABLED",
    });
    expect(leveRappelDetteGel).not.toHaveBeenCalled();
  });

  it("Zod strict refuse motif / actor client", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    const r = await leveRappelDetteGelAction({
      adherentId: "adh-1",
      gelId: "gel-1",
      motifTexte: "ne doit pas passer",
      leveParUserId: "evil",
    });
    expect(r).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(leveRappelDetteGel).not.toHaveBeenCalled();
  });

  it("succès lifted — actor session", async () => {
    auth.mockResolvedValue({
      user: { id: "pres-session", role: UserRole.PRESID },
    });
    leveRappelDetteGel.mockResolvedValue({
      ok: true,
      outcome: "lifted",
      gelId: "gel-1",
      adherentId: "adh-1",
      scope: "ADHERENT",
      statut: "LEVE",
      gelsRevision: "3",
    });
    const r = await leveRappelDetteGelAction({
      adherentId: "adh-1",
      gelId: "gel-1",
    });
    expect(r).toMatchObject({
      success: true,
      data: { outcome: "lifted", gelsRevision: "3" },
    });
    expect(leveRappelDetteGel).toHaveBeenCalledWith({
      actor: { userId: "pres-session", role: UserRole.PRESID },
      adherentId: "adh-1",
      gelId: "gel-1",
    });
  });
});
