import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const { auth, prepareRappelDetteConfirmation, isRappelDetteEnvoiEnabled } =
  vi.hoisted(() => ({
    auth: vi.fn(),
    prepareRappelDetteConfirmation: vi.fn(),
    isRappelDetteEnvoiEnabled: vi.fn(),
  }));

vi.mock("@/auth", () => ({ auth }));

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-activation",
  () => ({
    isRappelDetteEnvoiEnabled,
    RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE:
      "L’envoi de rappel de dette n’est pas activé sur ce serveur.",
    RAPPEL_DETTE_ENVOI_ENABLED: false,
  })
);

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-prepare-confirmation",
  () => ({
    prepareRappelDetteConfirmation,
  })
);

import { prepareRappelDetteConfirmationAction } from "@/actions/cotisations/prepare-rappel-dette-confirmation";

describe("prepareRappelDetteConfirmationAction", () => {
  beforeEach(() => {
    auth.mockReset();
    prepareRappelDetteConfirmation.mockReset();
    isRappelDetteEnvoiEnabled.mockReset();
    isRappelDetteEnvoiEnabled.mockReturnValue(true);
  });

  it("refuse non authentifié avant service", async () => {
    auth.mockResolvedValue(null);
    const r = await prepareRappelDetteConfirmationAction({
      adherentId: "adh-1",
    });
    expect(r).toEqual({
      success: false,
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
      code: "UNAUTHENTICATED",
      nextHint: "none",
    });
    expect(prepareRappelDetteConfirmation).not.toHaveBeenCalled();
  });

  it("refuse TRESOR avant service", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: UserRole.TRESOR } });
    const r = await prepareRappelDetteConfirmationAction({
      adherentId: "adh-1",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe("FORBIDDEN");
    expect(prepareRappelDetteConfirmation).not.toHaveBeenCalled();
  });

  it("flag off → refus avant service", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });
    isRappelDetteEnvoiEnabled.mockReturnValue(false);
    const r = await prepareRappelDetteConfirmationAction({
      adherentId: "adh-1",
    });
    expect(r).toMatchObject({
      success: false,
      code: "ENVOI_DISABLED",
    });
    expect(prepareRappelDetteConfirmation).not.toHaveBeenCalled();
  });

  it("refuse champs client interdits (strict)", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });
    const r = await prepareRappelDetteConfirmationAction({
      adherentId: "adh-1",
      detteNette: "999",
      role: UserRole.ADMIN,
      frozenAdherent: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe("VALIDATION_ERROR");
    expect(prepareRappelDetteConfirmation).not.toHaveBeenCalled();
  });

  it("délègue actor session uniquement (ADMIN)", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });
    prepareRappelDetteConfirmation.mockResolvedValue({
      ok: true,
      adherentId: "adh-1",
      clientConfirmationId: "c1",
      expectedFingerprint: "fp",
      templateVersion: "email-rappel-dette-v2",
      detteNette: "10.00",
      referenceAt: "2026-10-30T12:00:00.000Z",
      referenceLabel: "30/10/2026",
      recipientMasked: "j***@ex.test",
      prepareExpiresAt: "2026-10-30T12:10:00.000Z",
      confirmationToken: "rdc1.x.y",
      claims: {},
    });

    const r = await prepareRappelDetteConfirmationAction({
      adherentId: "adh-1",
    });
    expect(r.success).toBe(true);
    expect(prepareRappelDetteConfirmation).toHaveBeenCalledWith({
      actor: { userId: "admin-1", role: UserRole.ADMIN },
      adherentId: "adh-1",
    });
  });
});
