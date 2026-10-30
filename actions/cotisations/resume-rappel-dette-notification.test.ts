import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const { auth, isRappelDetteEnvoiEnabled, resumeRappelDetteNotification } =
  vi.hoisted(() => ({
    auth: vi.fn(),
    isRappelDetteEnvoiEnabled: vi.fn(),
    resumeRappelDetteNotification: vi.fn(),
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
  "@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send",
  () => ({
    resumeRappelDetteNotification,
  })
);

import { resumeRappelDetteNotificationAction } from "@/actions/cotisations/resume-rappel-dette-notification";

describe("resumeRappelDetteNotificationAction", () => {
  beforeEach(() => {
    auth.mockReset();
    isRappelDetteEnvoiEnabled.mockReset();
    resumeRappelDetteNotification.mockReset();
    isRappelDetteEnvoiEnabled.mockReturnValue(true);
  });

  it("flag off → pas de resume", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });
    isRappelDetteEnvoiEnabled.mockReturnValue(false);
    const r = await resumeRappelDetteNotificationAction({
      envoiId: "e1",
      adherentId: "adh-1",
    });
    expect(r).toMatchObject({ success: false, code: "ENVOI_DISABLED" });
    expect(resumeRappelDetteNotification).not.toHaveBeenCalled();
  });

  it("refuse champs interdits", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });
    const r = await resumeRappelDetteNotificationAction({
      envoiId: "e1",
      adherentId: "adh-1",
      sendEmail: true,
      push: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe("VALIDATION_ERROR");
    expect(resumeRappelDetteNotification).not.toHaveBeenCalled();
  });

  it("délègue resume notif (0 email) avec actor session", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.PRESID } });
    resumeRappelDetteNotification.mockResolvedValue({
      ok: true,
      phase: "notif_created",
      envoiId: "e1",
      reservationStatus: "Completed",
      emailStatus: "Accepted",
      notifStatus: "Created",
      message: "Notification créée — aucun email.",
      providerCallPerformed: false,
    });

    const r = await resumeRappelDetteNotificationAction({
      envoiId: "e1",
      adherentId: "adh-1",
    });
    expect(r.success).toBe(true);
    expect(resumeRappelDetteNotification).toHaveBeenCalledWith({
      actor: { userId: "admin-1", role: UserRole.PRESID },
      envoiId: "e1",
      adherentId: "adh-1",
    });
    if (r.success) {
      expect(r.data.providerCallPerformed).toBe(false);
      expect(r.data.message).toMatch(/aucun email/i);
    }
  });

  it("INVALID_STATE (non Accepted) → refus sans email", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });
    resumeRappelDetteNotification.mockResolvedValue({
      ok: false,
      code: "INVALID_STATE",
      message: "Email non accepté — reprise notification refusée",
      nextHint: "none",
      envoiId: "e1",
      providerCallPerformed: false,
    });
    const r = await resumeRappelDetteNotificationAction({
      envoiId: "e1",
      adherentId: "adh-1",
    });
    expect(r).toMatchObject({
      success: false,
      code: "INVALID_STATE",
      providerCallPerformed: false,
    });
  });
});
