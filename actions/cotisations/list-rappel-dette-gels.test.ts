import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";
import { RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE } from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads";

const { auth, listRappelDetteGelsByAdherent } = vi.hoisted(() => ({
  auth: vi.fn(),
  listRappelDetteGelsByAdherent: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads")
      >();
    return {
      ...actual,
      listRappelDetteGelsByAdherent,
    };
  }
);

import { listRappelDetteGelsAction } from "@/actions/cotisations/list-rappel-dette-gels";

describe("listRappelDetteGelsAction", () => {
  beforeEach(() => {
    auth.mockReset();
    listRappelDetteGelsByAdherent.mockReset();
  });

  it("refuse session absente avant métier", async () => {
    auth.mockResolvedValue(null);
    const r = await listRappelDetteGelsAction({ adherentId: "adh-1" });
    expect(r).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
    });
    expect(listRappelDetteGelsByAdherent).not.toHaveBeenCalled();
  });

  it("rôle refusé avant métier", async () => {
    auth.mockResolvedValue({
      user: { id: "u1", role: UserRole.MEMBRE },
    });
    const r = await listRappelDetteGelsAction({ adherentId: "adh-1" });
    expect(r).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(listRappelDetteGelsByAdherent).not.toHaveBeenCalled();
  });

  it("Zod strict refuse identité client et pageSize hors bornes", async () => {
    auth.mockResolvedValue({
      user: { id: "pres-1", role: UserRole.PRESID },
    });
    expect(
      await listRappelDetteGelsAction({
        adherentId: "adh-1",
        role: "ADMIN",
        userId: "evil",
      })
    ).toMatchObject({ success: false, code: "VALIDATION_ERROR" });

    expect(
      await listRappelDetteGelsAction({
        adherentId: "adh-1",
        pageSize: 100,
      })
    ).toMatchObject({ success: false, code: "VALIDATION_ERROR" });

    expect(listRappelDetteGelsByAdherent).not.toHaveBeenCalled();
  });

  it("succès PRESID : acteur = session uniquement", async () => {
    auth.mockResolvedValue({
      user: { id: "pres-1", role: UserRole.PRESID },
    });
    listRappelDetteGelsByAdherent.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "gel-1",
            adherentId: "adh-1",
            scope: "ADHERENT",
            statut: "ACTIF",
            lineSource: null,
            lineLabel: null,
            motifCode: "AUTRE",
            motifTexte: "x",
            referenceDossier: null,
            posedAt: "2026-09-15T08:00:00.000Z",
            poseParUserId: "pres-1",
            poseParLabel: "Président",
            leveAt: null,
            leveParUserId: null,
            leveParLabel: null,
          },
        ],
        pageSize: 20,
        hasMore: false,
        nextCursor: null,
      },
    });
    const r = await listRappelDetteGelsAction({ adherentId: "adh-1" });
    expect(r).toMatchObject({ success: true });
    if (!r.success) return;
    expect(r.data.items[0].motifTexte).toBe("x");
    expect(listRappelDetteGelsByAdherent).toHaveBeenCalledWith({
      actor: { userId: "pres-1", role: UserRole.PRESID },
      adherentId: "adh-1",
      pageSize: 20,
      cursor: null,
    });
  });

  it("propage SOURCE_UNAVAILABLE — jamais succès vide", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    listRappelDetteGelsByAdherent.mockResolvedValue({
      ok: false,
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
      message: "Source des gels indisponible",
    });
    const r = await listRappelDetteGelsAction({ adherentId: "adh-1" });
    expect(r).toMatchObject({
      success: false,
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
    });
    expect(r.success).toBe(false);
  });
});
