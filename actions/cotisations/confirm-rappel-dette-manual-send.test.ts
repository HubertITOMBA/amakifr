import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const {
  auth,
  isRappelDetteEnvoiEnabled,
  verifyRappelDetteConfirmationToken,
  buildSelectedRappelDetteServerTransport,
  orchestrateRappelDetteSend,
} = vi.hoisted(() => ({
  auth: vi.fn(),
  isRappelDetteEnvoiEnabled: vi.fn(),
  verifyRappelDetteConfirmationToken: vi.fn(),
  buildSelectedRappelDetteServerTransport: vi.fn(),
  orchestrateRappelDetteSend: vi.fn(),
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
  "@/lib/services/cotisations/rappel-dette/rappel-dette-confirmation-token",
  () => ({
    verifyRappelDetteConfirmationToken,
  })
);

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-server-transports",
  () => ({
    buildSelectedRappelDetteServerTransport,
  })
);

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send",
  () => ({
    RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2: "email-rappel-dette-v2",
    orchestrateRappelDetteSend,
  })
);

import { confirmRappelDetteManualSendAction } from "@/actions/cotisations/confirm-rappel-dette-manual-send";

const TEMPLATE_V2 = "email-rappel-dette-v2" as const;

const CLAIMS = {
  v: 1 as const,
  usage: "rappel_dette_prepare_v1" as const,
  actorUserId: "admin-1",
  adherentId: "adh-claims",
  fingerprint: "fp-claims",
  templateVersion: TEMPLATE_V2,
  clientConfirmationId: "conf-claims",
  issuedAt: Date.parse("2026-10-30T12:00:00.000Z"),
  expiresAt: Date.parse("2026-10-30T12:10:00.000Z"),
};

describe("confirmRappelDetteManualSendAction", () => {
  beforeEach(() => {
    auth.mockReset();
    isRappelDetteEnvoiEnabled.mockReset();
    verifyRappelDetteConfirmationToken.mockReset();
    buildSelectedRappelDetteServerTransport.mockReset();
    orchestrateRappelDetteSend.mockReset();
    isRappelDetteEnvoiEnabled.mockReturnValue(true);
  });

  it("refuse session absente", async () => {
    auth.mockResolvedValue(null);
    const r = await confirmRappelDetteManualSendAction({
      confirmationToken: "tok",
    });
    expect(r).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
    });
    expect(orchestrateRappelDetteSend).not.toHaveBeenCalled();
  });

  it("flag off → pas d’orch ni transport", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });
    isRappelDetteEnvoiEnabled.mockReturnValue(false);
    const r = await confirmRappelDetteManualSendAction({
      confirmationToken: "tok",
    });
    expect(r).toMatchObject({ success: false, code: "ENVOI_DISABLED" });
    expect(verifyRappelDetteConfirmationToken).not.toHaveBeenCalled();
    expect(buildSelectedRappelDetteServerTransport).not.toHaveBeenCalled();
    expect(orchestrateRappelDetteSend).not.toHaveBeenCalled();
  });

  it("refuse champs client interdits", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });
    const r = await confirmRappelDetteManualSendAction({
      confirmationToken: "tok",
      adherentId: "adh-client",
      expectedFingerprint: "fp-client",
      detteNette: "1",
      email: "x@y.z",
      provider: "smtp",
      frozenAdherent: true,
      RAPPEL_DETTE_ENVOI_ENABLED: true,
      deps: { isEnvoiEnabled: () => true },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe("VALIDATION_ERROR");
    expect(orchestrateRappelDetteSend).not.toHaveBeenCalled();
  });

  it("jeton expiré → reconfirm sans orch", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });
    verifyRappelDetteConfirmationToken.mockReturnValue({
      ok: false,
      code: "CONFIRMATION_TOKEN_EXPIRED",
      message: "Préparation expirée — nouvelle confirmation requise",
    });
    const r = await confirmRappelDetteManualSendAction({
      confirmationToken: "tok",
    });
    expect(r).toMatchObject({
      success: false,
      code: "CONFIRMATION_TOKEN_EXPIRED",
      nextHint: "reconfirm",
    });
    expect(orchestrateRappelDetteSend).not.toHaveBeenCalled();
  });

  it("jeton malformé / signature mauvaise longueur → pas de transport ni orch", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });

    const actual = await vi.importActual<
      typeof import("@/lib/services/cotisations/rappel-dette/rappel-dette-confirmation-token")
    >("@/lib/services/cotisations/rappel-dette/rappel-dette-confirmation-token");

    verifyRappelDetteConfirmationToken.mockImplementation(
      actual.verifyRappelDetteConfirmationToken
    );

    const secret = "confirm-malformed-token-secret";
    const signed = actual.signRappelDetteConfirmationToken({
      actorUserId: "admin-1",
      adherentId: "adh-1",
      fingerprint: "b".repeat(64),
      clientConfirmationId: "33333333-3333-4333-8333-333333333333",
      issuedAt: new Date("2026-10-30T12:00:00.000Z"),
      secret,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    const b64url = (buf: Buffer) =>
      buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    const parts = signed.token.split(".");
    const shortSigToken = `${parts[0]}.${parts[1]}.${b64url(Buffer.alloc(8, 1))}`;
    const malformedTokens = [
      "rdc1.!!!bad!!!.sig",
      "rdc1.only-two-parts",
      shortSigToken,
    ];

    const prev = process.env.RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET;
    process.env.RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET = secret;
    try {
      for (const confirmationToken of malformedTokens) {
        buildSelectedRappelDetteServerTransport.mockClear();
        orchestrateRappelDetteSend.mockClear();
        const r = await confirmRappelDetteManualSendAction({
          confirmationToken,
        });
        expect(r.success).toBe(false);
        if (!r.success) {
          expect(r.code).toBe("CONFIRMATION_TOKEN_INVALID");
          expect(r).not.toHaveProperty("data");
        }
        expect(buildSelectedRappelDetteServerTransport).not.toHaveBeenCalled();
        expect(orchestrateRappelDetteSend).not.toHaveBeenCalled();
      }
    } finally {
      if (prev === undefined) {
        delete process.env.RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET;
      } else {
        process.env.RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET = prev;
      }
    }
  });

  it("délègue claims jeton (pas copies client) + template v2 forcé", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });
    verifyRappelDetteConfirmationToken.mockReturnValue({
      ok: true,
      claims: CLAIMS,
    });
    buildSelectedRappelDetteServerTransport.mockReturnValue({
      ok: true,
      provider: { kind: "smtp", from: "noreply@amaki.fr" },
      smtpTransport: { sendMail: vi.fn() },
    });
    orchestrateRappelDetteSend.mockResolvedValue({
      ok: true,
      phase: "email_accepted",
      envoiId: "e1",
      reservationStatus: "Completed",
      emailStatus: "Accepted",
      notifStatus: "Created",
      message: "ok",
      providerCallPerformed: true,
    });

    const r = await confirmRappelDetteManualSendAction({
      confirmationToken: "tok-signed",
    });
    expect(r.success).toBe(true);
    expect(verifyRappelDetteConfirmationToken).toHaveBeenCalledWith({
      token: "tok-signed",
      actorUserId: "admin-1",
    });
    expect(orchestrateRappelDetteSend).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: "admin-1", role: UserRole.ADMIN },
        adherentId: "adh-claims",
        clientConfirmationId: "conf-claims",
        expectedFingerprint: "fp-claims",
        templateVersion: TEMPLATE_V2,
        smtpTransport: expect.anything(),
      })
    );
    const orchArg = orchestrateRappelDetteSend.mock.calls[0][0];
    expect(orchArg).not.toHaveProperty("frozenAdherent");
    expect(orchArg).not.toHaveProperty("deps");
    expect(orchArg.resendTransport).toBeUndefined();
  });

  it("mappe drift / Unknown sans secret fournisseur", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", role: UserRole.ADMIN } });
    verifyRappelDetteConfirmationToken.mockReturnValue({
      ok: true,
      claims: CLAIMS,
    });
    buildSelectedRappelDetteServerTransport.mockReturnValue({
      ok: true,
      provider: { kind: "resend", from: "noreply@amaki.fr" },
      resendTransport: { emails: { send: vi.fn() } },
    });

    orchestrateRappelDetteSend.mockResolvedValueOnce({
      ok: false,
      code: "REQUIRES_RECONFIRM",
      message: "Les données ont changé — nouvelle confirmation requise",
      nextHint: "reconfirm",
      providerCallPerformed: false,
    });
    const drift = await confirmRappelDetteManualSendAction({
      confirmationToken: "tok",
    });
    expect(drift).toMatchObject({
      success: false,
      code: "REQUIRES_RECONFIRM",
      nextHint: "reconfirm",
    });
    expect(JSON.stringify(drift)).not.toMatch(/apiKey|SMTP_PASS|stack|re_/i);

    orchestrateRappelDetteSend.mockResolvedValueOnce({
      ok: true,
      phase: "terminal_replay",
      envoiId: "e-u",
      reservationStatus: "Unknown",
      emailStatus: "Unknown",
      message:
        "Tentative en incertitude — aucun nouvel email ; réconciliation ops requise.",
      providerCallPerformed: false,
      technicalCode: "PROVIDER_TIMEOUT",
    });
    const unk = await confirmRappelDetteManualSendAction({
      confirmationToken: "tok",
    });
    expect(unk.success).toBe(true);
    if (unk.success) {
      expect(unk.data.phase).toBe("terminal_replay");
      expect(unk.data.providerCallPerformed).toBe(false);
    }
    expect(JSON.stringify(unk)).not.toMatch(/ECONNRESET|raw provider/i);
  });
});
