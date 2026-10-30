import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const {
  auth,
  getRappelDetteAdminCapabilities,
  isRappelDetteEnvoiEnabled,
  isRappelDetteGelMutationEnabled,
} = vi.hoisted(() => ({
  auth: vi.fn(),
  getRappelDetteAdminCapabilities: vi.fn(),
  isRappelDetteEnvoiEnabled: vi.fn(() => false),
  isRappelDetteGelMutationEnabled: vi.fn(() => false),
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
      getRappelDetteAdminCapabilities,
    };
  }
);

import { getRappelDetteAdminCapabilitiesAction } from "@/actions/cotisations/get-rappel-dette-admin-capabilities";

describe("getRappelDetteAdminCapabilitiesAction", () => {
  beforeEach(() => {
    auth.mockReset();
    getRappelDetteAdminCapabilities.mockReset();
    isRappelDetteEnvoiEnabled.mockReset();
    isRappelDetteGelMutationEnabled.mockReset();
  });

  it("refuse session absente avant métier", async () => {
    auth.mockResolvedValue(null);
    const r = await getRappelDetteAdminCapabilitiesAction({});
    expect(r).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
    });
    expect(getRappelDetteAdminCapabilities).not.toHaveBeenCalled();
  });

  it("rôle refusé avant métier", async () => {
    auth.mockResolvedValue({
      user: { id: "u1", role: UserRole.TRESOR },
    });
    const r = await getRappelDetteAdminCapabilitiesAction();
    expect(r).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(getRappelDetteAdminCapabilities).not.toHaveBeenCalled();
  });

  it("Zod strict refuse actor / rôle / flag client", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    const r = await getRappelDetteAdminCapabilitiesAction({
      actor: { userId: "evil", role: "ADMIN" },
      envoiEnabled: true,
    });
    expect(r).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(getRappelDetteAdminCapabilities).not.toHaveBeenCalled();
  });

  it("succès : session ADMIN → service avec identité session", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    getRappelDetteAdminCapabilities.mockReturnValue({
      ok: true,
      data: {
        canAccess: true,
        envoiEnabled: false,
        gelMutationEnabled: false,
        canProposeResend: false,
      },
    });
    const r = await getRappelDetteAdminCapabilitiesAction({});
    expect(r).toEqual({
      success: true,
      data: {
        canAccess: true,
        envoiEnabled: false,
        gelMutationEnabled: false,
        canProposeResend: false,
      },
    });
    expect(getRappelDetteAdminCapabilities).toHaveBeenCalledWith({
      userId: "admin-1",
      role: UserRole.ADMIN,
    });
  });
});
