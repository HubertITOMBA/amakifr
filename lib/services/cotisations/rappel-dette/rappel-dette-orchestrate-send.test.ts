import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL } from "@/lib/services/cotisations/rappel-dette/rappel-dette-reservation";
import {
  RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
  RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE,
  orchestrateRappelDetteSend,
  resumeRappelDetteNotification,
  type OrchestrateRappelDetteSendDeps,
  type RappelDetteEnvoiContentSnapshot,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send";

const ACTOR_ADMIN = { userId: "admin-1", role: "ADMIN" };
const ACTOR_PRESID = { userId: "pres-1", role: "PRESID" };
const ACTOR_TRESOR = { userId: "tre-1", role: "TRESOR" };
const ADH = "adh-1";
const ENVOI = "envoi-1";
const KEY = "conf-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const FP = "fp-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function baseSnapshot(
  overrides: Partial<RappelDetteEnvoiContentSnapshot> = {}
): RappelDetteEnvoiContentSnapshot {
  return {
    id: ENVOI,
    adherentId: ADH,
    recipientEmail: "destinataire@example.test",
    recipientUserId: "user-recipient",
    detteNette: "15.00",
    reservationStatus: "Reserved",
    emailStatus: "NotStarted",
    notifStatus: "NotStarted",
    emailAcceptedAt: null,
    payloadFingerprint: FP,
    templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
    reservedAt: new Date("2024-06-30T12:00:00.000Z"),
    ...overrides,
  };
}

function reservedOk(
  overrides: Record<string, unknown> = {}
): Extract<
  Awaited<ReturnType<NonNullable<OrchestrateRappelDetteSendDeps["reserve"]>>>,
  { ok: true }
> {
  return {
    ok: true as const,
    outcome: "created" as const,
    envoiId: ENVOI,
    adherentId: ADH,
    reservationStatus: "Reserved" as const,
    lockExpiresAt: new Date("2024-06-30T12:15:00.000Z"),
    payloadFingerprint: FP,
    templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
    templateDetailLinkContract: "contract-v2",
    providerCallAuthorized: false as const,
    ...overrides,
  };
}

function callingAuthorized() {
  return {
    ok: true as const,
    outcome: "authorized" as const,
    envoiId: ENVOI,
    adherentId: ADH,
    reservationStatus: "Calling" as const,
    providerCallAuthorized: true,
    callingAt: new Date("2024-06-30T12:00:01.000Z"),
  };
}

function persistAccepted() {
  return {
    ok: true as const,
    outcome: "persisted" as const,
    envoiId: ENVOI,
    adherentId: ADH,
    reservationStatus: "Completed" as const,
    emailStatus: "Accepted" as const,
    emailAcceptedAt: new Date("2024-06-30T12:00:02.000Z"),
    closedAt: null,
    unknownAt: null,
    notifStatus: "NotStarted" as const,
  };
}

function notifCreated() {
  return {
    ok: true as const,
    outcome: "created" as const,
    envoiId: ENVOI,
    adherentId: ADH,
    notifStatus: "Created" as const,
    notificationId: "notif-1",
    notificationCreatedAt: new Date("2024-06-30T12:00:03.000Z"),
    closedAt: new Date("2024-06-30T12:00:03.000Z"),
    emailAcceptedAt: new Date("2024-06-30T12:00:02.000Z"),
    opsTracesPreserved: false,
  };
}

describe("orchestrateRappelDetteSend", () => {
  const steps: string[] = [];
  let sendCount = 0;

  beforeEach(() => {
    steps.length = 0;
    sendCount = 0;
  });

  function happyDeps(
    extra: Partial<OrchestrateRappelDetteSendDeps> = {}
  ): OrchestrateRappelDetteSendDeps {
    return {
      isEnvoiEnabled: () => true,
      onStep: (s) => steps.push(s),
      reserve: vi.fn(async () => reservedOk()),
      authorizeCalling: vi.fn(async () => callingAuthorized()),
      validateProvider: () => ({
        ok: true,
        provider: { kind: "smtp", from: "noreply@amaki.fr" },
      }),
      loadEnvoiSnapshot: vi.fn(async () => baseSnapshot()),
      loadRecipientSalutation: vi.fn(async () => "Monsieur Test"),
      buildDetailUrl: () => "https://app.example/user/cotisations",
      buildEmailContent: () => ({
        subject: "sujet",
        html: "<p>x</p>",
        detailAbsoluteUrl: "https://app.example/user/cotisations",
        templateVersion: "email-rappel-dette-v2",
      }),
      sendSmtp: vi.fn(async () => {
        sendCount += 1;
        return { kind: "Accepted" as const };
      }),
      persistOutcome: vi.fn(async () => persistAccepted()),
      ensureNotification: vi.fn(async () => notifCreated()),
      ...extra,
    };
  }

  const smtpTransport = {
    sendMail: vi.fn(async () => ({ accepted: ["destinataire@example.test"] })),
  };

  it("T1 happy path : ordre étapes + 1 seul send", async () => {
    const deps = happyDeps();
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.phase).toBe("notif_created");
    expect(r.providerCallPerformed).toBe(true);
    expect(sendCount).toBe(1);
    expect(steps).toEqual([
      "auth_flag",
      "reserve",
      "validate_provider",
      "prepare_content",
      "validate_transport",
      "authorize_calling",
      "provider_call",
      "persist_outcome",
      "ensure_notification",
    ]);
    // validate_provider / contenu / transport avant authorize_calling
    expect(steps.indexOf("validate_provider")).toBeLessThan(
      steps.indexOf("authorize_calling")
    );
    expect(steps.indexOf("prepare_content")).toBeLessThan(
      steps.indexOf("authorize_calling")
    );
    expect(steps.indexOf("validate_transport")).toBeLessThan(
      steps.indexOf("authorize_calling")
    );
  });

  it("PRESID autorisé", async () => {
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_PRESID,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps(),
    });
    expect(r.ok).toBe(true);
  });

  it("T11 refus TRESOR / non auth", async () => {
    const r1 = await orchestrateRappelDetteSend({
      actor: ACTOR_TRESOR,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      deps: happyDeps(),
    });
    expect(r1.ok).toBe(false);
    if (r1.ok) throw new Error("expected fail");
    expect(r1.code).toBe("FORBIDDEN");
    expect(sendCount).toBe(0);

    const r2 = await orchestrateRappelDetteSend({
      actor: null,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      deps: happyDeps(),
    });
    expect(r2.ok).toBe(false);
    if (r2.ok) throw new Error("expected fail");
    expect(r2.code).toBe("UNAUTHENTICATED");
  });

  it("flag off → ENVOI_DISABLED sans reserve", async () => {
    const reserve = vi.fn(async () => reservedOk());
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      deps: happyDeps({
        isEnvoiEnabled: () => false,
        reserve,
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("ENVOI_DISABLED");
    expect(reserve).not.toHaveBeenCalled();
  });

  it("T10 config invalide avant Calling — Reserved intact", async () => {
    const authorizeCalling = vi.fn(async () => callingAuthorized());
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      deps: happyDeps({
        validateProvider: () => ({
          ok: false,
          code: "PROVIDER_CONFIG_INVALID",
          message: "Configuration Resend incomplète",
        }),
        authorizeCalling,
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("PROVIDER_CONFIG_INVALID");
    expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    expect(authorizeCalling).not.toHaveBeenCalled();
    expect(sendCount).toBe(0);
  });

  it("SMTP absent avant Calling — Reserved, 0 authorize/send/persist/notif", async () => {
    const authorizeCalling = vi.fn(async () => callingAuthorized());
    const persistOutcome = vi.fn(async () => persistAccepted());
    const ensureNotification = vi.fn(async () => notifCreated());
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      // smtpTransport omis
      deps: happyDeps({ authorizeCalling, persistOutcome, ensureNotification }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe(RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE);
    expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    expect(authorizeCalling).not.toHaveBeenCalled();
    expect(persistOutcome).not.toHaveBeenCalled();
    expect(ensureNotification).not.toHaveBeenCalled();
    expect(sendCount).toBe(0);
  });

  it("SMTP sendMail non callable — refus pré-Calling", async () => {
    const authorizeCalling = vi.fn(async () => callingAuthorized());
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport: { sendMail: "not-a-function" as unknown as () => Promise<never> },
      deps: happyDeps({ authorizeCalling }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe(RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE);
    expect(authorizeCalling).not.toHaveBeenCalled();
  });

  it("Resend absent / emails.send non callable — refus pré-Calling", async () => {
    const authorizeCalling = vi.fn(async () => callingAuthorized());
    const resendDeps = (): OrchestrateRappelDetteSendDeps =>
      happyDeps({
        authorizeCalling,
        validateProvider: () => ({
          ok: true,
          provider: { kind: "resend", from: "noreply@amaki.fr" },
        }),
        sendResend: vi.fn(async () => {
          sendCount += 1;
          return { kind: "Accepted" as const };
        }),
      });

    const rAbsent = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      deps: resendDeps(),
    });
    expect(rAbsent.ok).toBe(false);
    if (rAbsent.ok) throw new Error("expected fail");
    expect(rAbsent.code).toBe(RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE);
    expect(authorizeCalling).not.toHaveBeenCalled();

    const rBad = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      resendTransport: {
        emails: { send: null as unknown as () => Promise<never> },
      },
      deps: resendDeps(),
    });
    expect(rBad.ok).toBe(false);
    if (rBad.ok) throw new Error("expected fail");
    expect(rBad.code).toBe(RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE);
    expect(authorizeCalling).not.toHaveBeenCalled();
    expect(sendCount).toBe(0);
  });

  it("seul le transport du fournisseur sélectionné est exigé", async () => {
    // SMTP sélectionné : resendTransport absent OK
    const rSmtp = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        validateProvider: () => ({
          ok: true,
          provider: { kind: "smtp", from: "noreply@amaki.fr" },
        }),
      }),
    });
    expect(rSmtp.ok).toBe(true);

    // Resend sélectionné : smtpTransport absent OK
    const resendTransport = {
      emails: {
        send: vi.fn(async () => ({ data: { id: "re_1" }, error: null })),
      },
    };
    const rResend = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      resendTransport,
      deps: happyDeps({
        validateProvider: () => ({
          ok: true,
          provider: { kind: "resend", from: "noreply@amaki.fr" },
        }),
        sendResend: vi.fn(async () => {
          sendCount += 1;
          return { kind: "Accepted" as const };
        }),
      }),
    });
    expect(rResend.ok).toBe(true);
  });

  it("méthode capturée appelée avec son contexte this (SMTP et Resend)", async () => {
    const smtpCtx = { calls: 0 };
    const smtpWithThis = {
      marker: "smtp-ctx",
      sendMail: async function sendMail(this: { marker: string }) {
        expect(this.marker).toBe("smtp-ctx");
        smtpCtx.calls += 1;
        return { accepted: ["destinataire@example.test"] };
      },
    };
    const rSmtp = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport: smtpWithThis,
      deps: happyDeps({
        sendSmtp: async (transport, req) => {
          await transport.sendMail({
            from: req.from,
            to: req.to,
            subject: req.subject,
            html: req.html,
          });
          sendCount += 1;
          return { kind: "Accepted" as const };
        },
      }),
    });
    expect(rSmtp.ok).toBe(true);
    expect(smtpCtx.calls).toBe(1);

    const resendCtx = { calls: 0 };
    const resendWithThis = {
      emails: {
        marker: "resend-emails",
        send: async function send(this: { marker: string }) {
          expect(this.marker).toBe("resend-emails");
          resendCtx.calls += 1;
          return { data: { id: "re_ctx" }, error: null };
        },
      },
    };
    const rResend = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      resendTransport: resendWithThis,
      deps: happyDeps({
        validateProvider: () => ({
          ok: true,
          provider: { kind: "resend", from: "noreply@amaki.fr" },
        }),
        sendResend: async (transport, req) => {
          await transport.emails.send({
            from: req.from,
            to: [req.to],
            subject: req.subject,
            html: req.html,
          });
          sendCount += 1;
          return { kind: "Accepted" as const };
        },
      }),
    });
    expect(rResend.ok).toBe(true);
    expect(resendCtx.calls).toBe(1);
    expect(sendCount).toBe(2);
  });

  it("câblage corrigé puis reprise même réservation (contrôles habituels)", async () => {
    const authorizeCalling = vi.fn(async () => callingAuthorized());
    const reserve = vi.fn(async () =>
      reservedOk({ outcome: "idempotent" })
    );
    const base = {
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
    } as const;

    const first = await orchestrateRappelDetteSend({
      ...base,
      deps: happyDeps({ authorizeCalling, reserve }),
    });
    expect(first.ok).toBe(false);
    if (first.ok) throw new Error("expected fail");
    expect(first.code).toBe(RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE);
    expect(first.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    expect(authorizeCalling).not.toHaveBeenCalled();

    // Reprise : même clé + empreinte, transport désormais injecté
    const second = await orchestrateRappelDetteSend({
      ...base,
      smtpTransport,
      deps: happyDeps({ authorizeCalling, reserve }),
    });
    expect(second.ok).toBe(true);
    expect(authorizeCalling).toHaveBeenCalledTimes(1);
    expect(sendCount).toBe(1);
    expect(reserve).toHaveBeenCalledTimes(2);
  });

  it("contenu invalide avant Calling — pas de send", async () => {
    const authorizeCalling = vi.fn(async () => callingAuthorized());
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      deps: happyDeps({
        buildDetailUrl: () => null,
        authorizeCalling,
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("CONTENT_INVALID");
    expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    expect(authorizeCalling).not.toHaveBeenCalled();
  });

  it("T12 drift fingerprint à reserve", async () => {
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      deps: happyDeps({
        reserve: vi.fn(async () => ({
          ok: false as const,
          code: "REQUIRES_RECONFIRM" as const,
          message: "Empreinte divergente",
        })),
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("REQUIRES_RECONFIRM");
    expect(r.nextHint).toBe("reconfirm");
    expect(sendCount).toBe(0);
  });

  it("drift pré-Calling → refus, contenu abandonné, pas de send", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Accepted" as const };
    });
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        sendSmtp,
        authorizeCalling: vi.fn(async () => ({
          ok: false as const,
          code: "REQUIRES_RECONFIRM" as const,
          message: "Snapshot modifié",
          reservedFate: RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
        })),
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("REQUIRES_RECONFIRM");
    expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    expect(sendSmtp).not.toHaveBeenCalled();
  });

  it("T2/T3 already_started / providerCallAuthorized=false → 0 send", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Accepted" as const };
    });
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        sendSmtp,
        authorizeCalling: vi.fn(async () => ({
          ok: true as const,
          outcome: "already_started" as const,
          envoiId: ENVOI,
          adherentId: ADH,
          reservationStatus: "Calling" as const,
          providerCallAuthorized: false,
          callingAt: new Date(),
        })),
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("ENVOI_IN_PROGRESS_OR_BLOCKED");
    expect(sendSmtp).not.toHaveBeenCalled();
  });

  it("T4 concurrence simulée : un seul providerCallAuthorized=true", async () => {
    let authorizeCalls = 0;
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Accepted" as const };
    });
    const depsFactory = (): OrchestrateRappelDetteSendDeps =>
      happyDeps({
        sendSmtp,
        authorizeCalling: vi.fn(async () => {
          authorizeCalls += 1;
          if (authorizeCalls === 1) return callingAuthorized();
          return {
            ok: true as const,
            outcome: "already_started" as const,
            envoiId: ENVOI,
            adherentId: ADH,
            reservationStatus: "Calling" as const,
            providerCallAuthorized: false,
            callingAt: new Date(),
          };
        }),
      });

    const r1 = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: depsFactory(),
    });
    const r2 = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: depsFactory(),
    });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    expect(sendCount).toBe(1);
    // Limite : simulation d’ordonnancement mockée — pas une preuve PG
  });

  it("T5 rejeu Calling bloqué sans send", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Accepted" as const };
    });
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        sendSmtp,
        reserve: vi.fn(async () =>
          reservedOk({ reservationStatus: "Calling" })
        ),
        loadEnvoiSnapshot: vi.fn(async () =>
          baseSnapshot({ reservationStatus: "Calling", emailStatus: "Calling" })
        ),
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("ENVOI_IN_PROGRESS_OR_BLOCKED");
    expect(sendSmtp).not.toHaveBeenCalled();
  });

  it("rejeu terminal Completed → état réel, 0 email", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Accepted" as const };
    });
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        sendSmtp,
        reserve: vi.fn(async () =>
          reservedOk({ reservationStatus: "Completed" })
        ),
        loadEnvoiSnapshot: vi.fn(async () =>
          baseSnapshot({
            reservationStatus: "Completed",
            emailStatus: "Accepted",
            notifStatus: "Created",
            emailAcceptedAt: new Date(),
          })
        ),
      }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.phase).toBe("terminal_replay");
    expect(r.providerCallPerformed).toBe(false);
    expect(sendSmtp).not.toHaveBeenCalled();
  });

  it("T6 Accepted + persist throw → PROVIDER_ACCEPTED_PERSIST_FAILED", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Accepted" as const };
    });
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        sendSmtp,
        persistOutcome: vi.fn(async () => {
          throw new Error("tx boom");
        }),
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("PROVIDER_ACCEPTED_PERSIST_FAILED");
    expect(sendCount).toBe(1);
  });

  it("échec persist retourné (non Accepted) → PERSIST_FAILED_BLOCKING, pas DNA", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Unknown" as const, technicalCode: "SMTP_TIMEOUT" };
    });
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        sendSmtp,
        persistOutcome: vi.fn(async () => ({
          ok: false as const,
          code: "INTERNAL_ERROR" as const,
          message: "persist ko",
        })),
      }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("PERSIST_FAILED_BLOCKING");
    expect(r.code).not.toBe("DefinitelyNotAccepted");
  });

  it("T7 Unknown après exception fournisseur", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      throw new Error("socket reset");
    });
    const persistOutcome = vi.fn(async (input: { outcome: { kind: string } }) => {
      expect(input.outcome.kind).toBe("Unknown");
      return {
        ok: true as const,
        outcome: "persisted" as const,
        envoiId: ENVOI,
        adherentId: ADH,
        reservationStatus: "Unknown" as const,
        emailStatus: "Unknown" as const,
        emailAcceptedAt: null,
        closedAt: null,
        unknownAt: new Date(),
        notifStatus: "NotStarted" as const,
      };
    });
    const ensureNotification = vi.fn(async () => notifCreated());
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({ sendSmtp, persistOutcome, ensureNotification }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.phase).toBe("email_unknown");
    expect(ensureNotification).not.toHaveBeenCalled();
  });

  it("Accepted + notif échouée → reprise notif, pas renvoi email", async () => {
    const sendSmtp = vi.fn(async () => {
      sendCount += 1;
      return { kind: "Accepted" as const };
    });
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        sendSmtp,
        ensureNotification: vi.fn(async () => ({
          ok: false as const,
          code: "INTERNAL_ERROR" as const,
          message: "notif boom",
        })),
      }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.phase).toBe("notif_failed");
    expect(r.emailStatus).toBe("Accepted");
    expect(sendCount).toBe(1);
  });

  it("T8/T9 resume notif seule — 0 email ; refus si non Accepted", async () => {
    const ensureOk = vi.fn(async () => notifCreated());
    const rOk = await resumeRappelDetteNotification({
      actor: ACTOR_ADMIN,
      envoiId: ENVOI,
      adherentId: ADH,
      deps: {
        isEnvoiEnabled: () => true,
        ensureNotification: ensureOk,
      },
    });
    expect(rOk.ok).toBe(true);
    if (!rOk.ok) throw new Error("expected ok");
    expect(rOk.providerCallPerformed).toBe(false);
    expect(rOk.phase).toBe("notif_created");

    const rKo = await resumeRappelDetteNotification({
      actor: ACTOR_ADMIN,
      envoiId: ENVOI,
      adherentId: ADH,
      deps: {
        isEnvoiEnabled: () => true,
        ensureNotification: vi.fn(async () => ({
          ok: false as const,
          code: "INVALID_STATE" as const,
          message: "Preuve email Accepted requise",
        })),
      },
    });
    expect(rKo.ok).toBe(false);
    if (rKo.ok) throw new Error("expected fail");
    expect(rKo.code).toBe("INVALID_STATE");
  });

  it("T14 payload UI sans secrets", async () => {
    const r = await orchestrateRappelDetteSend({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: FP,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport,
      deps: happyDeps({
        env: {
          RESEND_API_KEY: "re_secret_should_not_leak",
          SMTP_PASS: "smtp_secret",
        },
      }),
    });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/re_secret|smtp_secret|apiKey|SMTP_PASS|stack/i);
    expect(Object.keys(r)).not.toContain("html");
  });

  it("orchestrateur non réexporté du barrel", () => {
    const barrel = readFileSync(
      path.resolve(__dirname, "index.ts"),
      "utf8"
    );
    expect(barrel).toMatch(/Orchestrateur d['’]envoi Lot 3/);
    expect(barrel).toMatch(/\*\*ne pas\*\* réexporter ici/);
    expect(barrel).not.toMatch(
      /export \{[^}]*orchestrateRappelDetteSend/
    );
  });
});
