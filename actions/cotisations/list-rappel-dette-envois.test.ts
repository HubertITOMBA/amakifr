import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";
import { RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE } from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads";

const { auth, listRappelDetteEnvoisByAdherent } = vi.hoisted(() => ({
  auth: vi.fn(),
  listRappelDetteEnvoisByAdherent: vi.fn(),
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
      listRappelDetteEnvoisByAdherent,
    };
  }
);

import { listRappelDetteEnvoisAction } from "@/actions/cotisations/list-rappel-dette-envois";

describe("listRappelDetteEnvoisAction", () => {
  beforeEach(() => {
    auth.mockReset();
    listRappelDetteEnvoisByAdherent.mockReset();
  });

  it("refuse session absente avant métier", async () => {
    auth.mockResolvedValue(null);
    const r = await listRappelDetteEnvoisAction({ adherentId: "adh-1" });
    expect(r).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
    });
    expect(listRappelDetteEnvoisByAdherent).not.toHaveBeenCalled();
  });

  it("rôle refusé avant métier", async () => {
    auth.mockResolvedValue({
      user: { id: "u1", role: UserRole.TRESOR },
    });
    const r = await listRappelDetteEnvoisAction({ adherentId: "adh-1" });
    expect(r).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(listRappelDetteEnvoisByAdherent).not.toHaveBeenCalled();
  });

  it("Zod strict refuse actor / rôle / pageSize hors bornes", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    expect(
      await listRappelDetteEnvoisAction({
        adherentId: "adh-1",
        actor: { userId: "evil" },
      })
    ).toMatchObject({ success: false, code: "VALIDATION_ERROR" });

    expect(
      await listRappelDetteEnvoisAction({
        adherentId: "adh-1",
        pageSize: 51,
      })
    ).toMatchObject({ success: false, code: "VALIDATION_ERROR" });

    expect(
      await listRappelDetteEnvoisAction({
        adherentId: "adh-1",
        pageSize: 0,
      })
    ).toMatchObject({ success: false, code: "VALIDATION_ERROR" });

    expect(listRappelDetteEnvoisByAdherent).not.toHaveBeenCalled();
  });

  it("succès : passe identité session, jamais client", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    listRappelDetteEnvoisByAdherent.mockResolvedValue({
      ok: true,
      data: {
        items: [],
        pageSize: 20,
        hasMore: false,
        nextCursor: null,
      },
    });
    const r = await listRappelDetteEnvoisAction({
      adherentId: "adh-1",
      pageSize: 10,
      cursor: null,
    });
    expect(r).toMatchObject({ success: true });
    expect(listRappelDetteEnvoisByAdherent).toHaveBeenCalledWith({
      actor: { userId: "admin-1", role: UserRole.ADMIN },
      adherentId: "adh-1",
      pageSize: 10,
      cursor: null,
    });
  });

  it("propage SOURCE_UNAVAILABLE", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    listRappelDetteEnvoisByAdherent.mockResolvedValue({
      ok: false,
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
      message: "Source des envois indisponible",
    });
    const r = await listRappelDetteEnvoisAction({ adherentId: "adh-1" });
    expect(r).toMatchObject({
      success: false,
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
      error: "Source des envois indisponible",
    });
  });
});
