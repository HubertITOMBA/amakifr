import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const { auth, previewRappelsDetteAdmin } = vi.hoisted(() => ({
  auth: vi.fn(),
  previewRappelsDetteAdmin: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));

vi.mock(
  "@/lib/services/cotisations/rappel-dette/preview-rappels-admin",
  () => ({
    previewRappelsDetteAdmin,
    PREVIEW_RAPPELS_BANNER: "Prévisualisation — aucun envoi",
  })
);

import { getPreviewRappelsDetteAction } from "@/actions/cotisations/preview-rappels-dette";

const emptyPreview = {
  mode: "dry-run" as const,
  banner: "Prévisualisation — aucun envoi",
  computedAt: "2024-06-30T12:00:00.000Z",
  timezone: "Europe/Paris",
  incomplete: false,
  incompleteAlert: null,
  totals: {
    adherentsScanned: 0,
    eligibleCount: 0,
    excludedCount: 0,
    failedCount: 0,
    totalsPartial: false,
    montantBrutEligibleTotal: "0",
    detteNetteEligibleTotal: "0",
  },
  eligible: [],
  excluded: [],
  failed: [],
};

describe("getPreviewRappelsDetteAction", () => {
  beforeEach(() => {
    auth.mockReset();
    previewRappelsDetteAdmin.mockReset();
  });

  it("refuse un utilisateur non authentifié avant le service", async () => {
    auth.mockResolvedValue(null);
    const result = await getPreviewRappelsDetteAction();
    expect(result).toEqual({
      success: false,
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
      code: "UNAUTHENTICATED",
    });
    expect(previewRappelsDetteAdmin).not.toHaveBeenCalled();
  });

  it("refuse tous les rôles hors ADMIN/PRESID avant le service", async () => {
    const denied = [
      UserRole.MEMBRE,
      UserRole.INVITE,
      UserRole.VICEPR,
      UserRole.SECRET,
      UserRole.VICESE,
      UserRole.COMCPT,
      UserRole.TRESOR,
      UserRole.VTRESO,
    ] as const;

    for (const role of denied) {
      auth.mockResolvedValue({ user: { id: "u1", role } });
      previewRappelsDetteAdmin.mockClear();
      const result = await getPreviewRappelsDetteAction();
      expect(result).toEqual({
        success: false,
        error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
        code: "FORBIDDEN",
      });
      expect(previewRappelsDetteAdmin).not.toHaveBeenCalled();
    }
  });

  it("délègue au service pour un ADMIN sans options client", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    previewRappelsDetteAdmin.mockResolvedValue(emptyPreview);

    const result = await getPreviewRappelsDetteAction();
    expect(result.success).toBe(true);
    expect(previewRappelsDetteAdmin).toHaveBeenCalledTimes(1);
    expect(previewRappelsDetteAdmin).toHaveBeenCalledWith({
      userId: "admin-1",
      role: UserRole.ADMIN,
    });
    expect(previewRappelsDetteAdmin.mock.calls[0]).toHaveLength(1);
  });

  it("délègue au service pour un PRESID sans options client", async () => {
    auth.mockResolvedValue({
      user: { id: "pres-1", role: UserRole.PRESID },
    });
    previewRappelsDetteAdmin.mockResolvedValue(emptyPreview);

    const result = await getPreviewRappelsDetteAction();
    expect(result.success).toBe(true);
    expect(previewRappelsDetteAdmin).toHaveBeenCalledWith({
      userId: "pres-1",
      role: UserRole.PRESID,
    });
  });
});
