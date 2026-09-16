import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const {
  noteFindUnique,
  noteFindFirst,
  noteFindMany,
  noteCreate,
  noteUpdate,
  noteUpdateMany,
  justifFindUnique,
  justifFindFirst,
  justifCreate,
  justifUpdate,
  justifDelete,
  justifCount,
  outboxFindFirst,
  outboxFindMany,
  outboxCreate,
  outboxUpdateMany,
  outboxFindUnique,
  fileJobCreate,
  fileJobUpdateMany,
  fileJobFindMany,
  notificationCreateMany,
  userFindUnique,
  $transaction,
  $executeRaw,
} = vi.hoisted(() => ({
  noteFindUnique: vi.fn(),
  noteFindFirst: vi.fn(),
  noteFindMany: vi.fn(),
  noteCreate: vi.fn(),
  noteUpdate: vi.fn(),
  noteUpdateMany: vi.fn(),
  justifFindUnique: vi.fn(),
  justifFindFirst: vi.fn(),
  justifCreate: vi.fn(),
  justifUpdate: vi.fn(),
  justifDelete: vi.fn(),
  justifCount: vi.fn(),
  outboxFindFirst: vi.fn(),
  outboxFindMany: vi.fn(),
  outboxCreate: vi.fn(),
  outboxUpdateMany: vi.fn(),
  outboxFindUnique: vi.fn(),
  fileJobCreate: vi.fn(),
  fileJobUpdateMany: vi.fn(),
  fileJobFindMany: vi.fn(),
  notificationCreateMany: vi.fn(),
  userFindUnique: vi.fn(),
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    noteFrais: {
      findUnique: (...a: unknown[]) => noteFindUnique(...a),
      findFirst: (...a: unknown[]) => noteFindFirst(...a),
      findMany: (...a: unknown[]) => noteFindMany(...a),
      create: (...a: unknown[]) => noteCreate(...a),
      update: (...a: unknown[]) => noteUpdate(...a),
      updateMany: (...a: unknown[]) => noteUpdateMany(...a),
      findUniqueOrThrow: (...a: unknown[]) => noteFindUnique(...a),
    },
    justificatifNoteFrais: {
      findUnique: (...a: unknown[]) => justifFindUnique(...a),
      findFirst: (...a: unknown[]) => justifFindFirst(...a),
      create: (...a: unknown[]) => justifCreate(...a),
      update: (...a: unknown[]) => justifUpdate(...a),
      delete: (...a: unknown[]) => justifDelete(...a),
      count: (...a: unknown[]) => justifCount(...a),
    },
    noteFraisOutboxEvent: {
      findFirst: (...a: unknown[]) => outboxFindFirst(...a),
      findMany: (...a: unknown[]) => outboxFindMany(...a),
      create: (...a: unknown[]) => outboxCreate(...a),
      updateMany: (...a: unknown[]) => outboxUpdateMany(...a),
      findUnique: (...a: unknown[]) => outboxFindUnique(...a),
    },
    noteFraisFileJob: {
      create: (...a: unknown[]) => fileJobCreate(...a),
      updateMany: (...a: unknown[]) => fileJobUpdateMany(...a),
      findMany: (...a: unknown[]) => fileJobFindMany(...a),
    },
    notification: {
      createMany: (...a: unknown[]) => notificationCreateMany(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userAdminRole: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: (...a: unknown[]) => $transaction(...a),
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
  },
}));

vi.mock("@/lib/frais-avances/authz", () => ({
  canUserReadSubmittedNotesFrais: vi.fn(),
}));

vi.mock("@/lib/frais-avances/recipients", () => ({
  resolveSubmissionRecipientUserIds: vi.fn(),
}));

vi.mock("@/lib/frais-avances/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/frais-avances/storage")
  >("@/lib/frais-avances/storage");
  return {
    ...actual,
    writeTempFile: vi.fn().mockResolvedValue({
      uploadId: "u",
      absolutePath: "/tmp/amaki-notes-test-root/tmp/u.pdf",
    }),
    moveFileDurable: vi.fn().mockResolvedValue(undefined),
    unlinkQuiet: vi.fn().mockResolvedValue(undefined),
    absoluteFromRelative: vi.fn((rel: string) =>
      `/tmp/amaki-notes-test-root/${rel}`
    ),
  };
});

vi.mock("@/lib/services/push/send-push", () => ({
  sendPushToUsersDetailed: vi.fn(),
}));

import { canUserReadSubmittedNotesFrais } from "@/lib/frais-avances/authz";
import { resolveSubmissionRecipientUserIds } from "@/lib/frais-avances/recipients";
import { toNoteFraisPublicDto } from "@/lib/frais-avances/dto";
import {
  deleteNoteFraisJustificatif,
  downloadNoteFraisJustificatif,
  getNoteFraisForUser,
  listAdminNotesFrais,
  submitNoteFrais,
  updateNoteFraisDraft,
} from "@/lib/services/frais-avances/note-frais-service";

describe("DTO publics", () => {
  it("n'expose jamais cheminRelatif", () => {
    const dto = toNoteFraisPublicDto({
      id: "n1",
      libelle: "L",
      description: null,
      dateDepense: new Date(),
      montantDemande: "10.00",
      statut: "BROUILLON",
      version: 1,
      soumiseAt: null,
      alerteSansDestinataire: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      Justificatifs: [
        {
          id: "j1",
          nomFichierOrig: "a.pdf",
          typeMime: "application/pdf",
          taille: 10,
          statut: "READY",
          createdAt: new Date(),
          cheminRelatif: "notes/n1/j1.pdf",
        },
      ],
    });
    expect(JSON.stringify(dto)).not.toMatch(/cheminRelatif|cheminStockage/);
    expect(dto.Justificatifs[0]).toMatchObject({ id: "j1", statut: "READY" });
  });
});

describe("métier notes-frais (mocks)", () => {
  const prev = process.env.NOTES_FRAIS_ENABLED;

  beforeEach(() => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    process.env.NOTES_FRAIS_STORAGE_ROOT = "/tmp/amaki-notes-test-root";
    vi.clearAllMocks();
    vi.mocked(canUserReadSubmittedNotesFrais).mockResolvedValue(false);
    vi.mocked(resolveSubmissionRecipientUserIds).mockResolvedValue(["admin1"]);
    $executeRaw.mockResolvedValue(undefined);
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        $executeRaw,
        noteFrais: {
          findUnique: noteFindUnique,
          findFirst: noteFindFirst,
          findMany: noteFindMany,
          create: noteCreate,
          update: noteUpdate,
          updateMany: noteUpdateMany,
          findUniqueOrThrow: noteFindUnique,
        },
        justificatifNoteFrais: {
          findUnique: justifFindUnique,
          findFirst: justifFindFirst,
          create: justifCreate,
          update: justifUpdate,
          delete: justifDelete,
          count: justifCount,
        },
        noteFraisOutboxEvent: {
          findFirst: outboxFindFirst,
          findMany: outboxFindMany,
          create: outboxCreate,
          updateMany: outboxUpdateMany,
          findUnique: outboxFindUnique,
        },
        noteFraisFileJob: {
          create: fileJobCreate,
          updateMany: fileJobUpdateMany,
          findMany: fileJobFindMany,
        },
        notification: { createMany: notificationCreateMany },
      };
      return fn(tx);
    });
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.NOTES_FRAIS_ENABLED;
    else process.env.NOTES_FRAIS_ENABLED = prev;
  });

  it("flag off : aucune écriture note", async () => {
    delete process.env.NOTES_FRAIS_ENABLED;
    const res = await updateNoteFraisDraft({
      userId: "u1",
      noteId: "n1",
      expectedVersion: 1,
      libelle: "x",
    });
    expect(res.success).toBe(false);
    expect(noteUpdateMany).not.toHaveBeenCalled();
  });

  it("IDOR : non-propriétaire ne lit pas un brouillon", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      demandeurUserId: "owner",
      statut: "BROUILLON",
      libelle: "L",
      description: null,
      dateDepense: new Date(),
      montantDemande: "1",
      version: 1,
      soumiseAt: null,
      alerteSansDestinataire: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      Justificatifs: [],
    });
    vi.mocked(canUserReadSubmittedNotesFrais).mockResolvedValue(true);
    const res = await getNoteFraisForUser({ userId: "other", noteId: "n1" });
    expect(res.success).toBe(false);
  });

  it("admin : détail SOUMISE OK, liste sans brouillon", async () => {
    vi.mocked(canUserReadSubmittedNotesFrais).mockResolvedValue(true);
    noteFindUnique.mockResolvedValue({
      id: "n1",
      demandeurUserId: "owner",
      statut: "SOUMISE",
      libelle: "L",
      description: null,
      dateDepense: new Date(),
      montantDemande: "1",
      version: 2,
      soumiseAt: new Date(),
      alerteSansDestinataire: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      Justificatifs: [],
    });
    const detail = await getNoteFraisForUser({ userId: "admin", noteId: "n1" });
    expect(detail.success).toBe(true);

    noteFindMany.mockResolvedValue([]);
    await listAdminNotesFrais({ actorUserId: "admin" });
    expect(noteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: { in: ["SOUMISE", "VALIDEE", "REJETEE"] },
        }),
      })
    );
  });

  it("listAdmin refuse sans droits", async () => {
    vi.mocked(canUserReadSubmittedNotesFrais).mockResolvedValue(false);
    const res = await listAdminNotesFrais({ actorUserId: "u" });
    expect(res.success).toBe(false);
    expect(noteFindMany).not.toHaveBeenCalled();
  });

  it("conflit de version sur édition", async () => {
    noteUpdateMany.mockResolvedValue({ count: 0 });
    noteFindFirst.mockResolvedValue({ statut: "BROUILLON" });
    const res = await updateNoteFraisDraft({
      userId: "u1",
      noteId: "n1",
      expectedVersion: 1,
      libelle: "x",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("VERSION_CONFLICT");
  });

  it("soumission refuse sans clé d'idempotence", async () => {
    const res = await submitNoteFrais({
      userId: "u1",
      noteId: "n1",
      idempotencyKey: "",
      expectedVersion: 1,
    });
    expect(res.success).toBe(false);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("soumission idempotente : déjà soumise → résultat cohérent", async () => {
    noteFindFirst.mockResolvedValue({
      id: "n1",
      demandeurUserId: "u1",
      statut: "SOUMISE",
      submitIdempotencyKey: "idem-key-01",
      alerteSansDestinataire: false,
      version: 3,
    });
    outboxFindFirst.mockResolvedValue({
      payload: { userIds: ["a", "b"] },
    });
    const res = await submitNoteFrais({
      userId: "u1",
      noteId: "n1",
      idempotencyKey: "idem-key-01",
      expectedVersion: 2,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadySubmitted).toBe(true);
      expect(res.data.recipientCount).toBe(2);
    }
    expect($transaction).not.toHaveBeenCalled();
  });

  it("soumission TX : READY requis, notifs + outbox uniques", async () => {
    noteFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "n1",
        demandeurUserId: "u1",
        statut: "BROUILLON",
        version: 2,
      });
    justifCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    noteUpdateMany.mockResolvedValue({ count: 1 });
    noteFindUnique.mockResolvedValue({
      id: "n1",
      version: 3,
      alerteSansDestinataire: false,
    });
    outboxFindMany.mockResolvedValue([]);
    outboxUpdateMany.mockResolvedValue({ count: 0 });
    notificationCreateMany.mockResolvedValue({ count: 1 });
    outboxCreate.mockResolvedValue({ id: "o1" });

    const res = await submitNoteFrais({
      userId: "u1",
      noteId: "n1",
      idempotencyKey: "idem-key-abc",
      expectedVersion: 2,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadySubmitted).toBe(false);
      expect(res.data.recipientCount).toBe(1);
    }
    expect(notificationCreateMany).toHaveBeenCalledTimes(1);
    expect(outboxCreate).toHaveBeenCalledTimes(1);
    const outboxArg = outboxCreate.mock.calls[0][0];
    expect(outboxArg.data.eventKey).toBe("note:n1:submitted");
  });

  it("soumission refuse si PENDING restant", async () => {
    noteFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "n1",
        demandeurUserId: "u1",
        statut: "BROUILLON",
        version: 1,
      });
    justifCount.mockResolvedValueOnce(1);

    const res = await submitNoteFrais({
      userId: "u1",
      noteId: "n1",
      idempotencyKey: "idem-key-xyz",
      expectedVersion: 1,
    });
    expect(res.success).toBe(false);
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  it("download : READY propriétaire OK ; non-READY refusé", async () => {
    justifFindUnique.mockResolvedValue({
      id: "j1",
      statut: "PENDING",
      cheminRelatif: "notes/n1/j1.pdf",
      typeMime: "application/pdf",
      nomFichierOrig: "a.pdf",
      NoteFrais: {
        id: "n1",
        demandeurUserId: "u1",
        statut: "BROUILLON",
      },
    });
    const bad = await downloadNoteFraisJustificatif({
      userId: "u1",
      justificatifId: "j1",
    });
    expect(bad.success).toBe(false);
  });

  it("delete PJ brouillon crée job UNLINK", async () => {
    noteUpdateMany.mockResolvedValue({ count: 1 });
    justifFindFirst.mockResolvedValue({
      id: "j1",
      noteFraisId: "n1",
      cheminRelatif: "notes/n1/j1.pdf",
    });
    justifDelete.mockResolvedValue({});
    fileJobCreate.mockResolvedValue({ id: "fj1" });
    fileJobFindMany.mockResolvedValue([]);
    fileJobUpdateMany.mockResolvedValue({ count: 0 });

    const res = await deleteNoteFraisJustificatif({
      userId: "u1",
      noteId: "n1",
      justificatifId: "j1",
      expectedVersion: 1,
    });
    expect(res.success).toBe(true);
    expect(justifDelete).toHaveBeenCalled();
    expect(fileJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ operation: "UNLINK" }),
      })
    );
  });

  it("lot 4.0 : Depense charge OK à la décision ; pas d'Avoir/Paiement/exécution", async () => {
    const { readFile } = await import("node:fs/promises");
    const serviceSrc = await readFile(
      "/soft/dev/nextjs/amakifr/lib/services/frais-avances/note-frais-service.ts",
      "utf8"
    );
    const decisionSrc = await readFile(
      "/soft/dev/nextjs/amakifr/lib/services/frais-avances/note-frais-decision-service.ts",
      "utf8"
    );
    const choixSrc = await readFile(
      "/soft/dev/nextjs/amakifr/lib/services/frais-avances/note-frais-choix-reglement-service.ts",
      "utf8"
    );
    // Soumission / service : toujours hors Depense / Avoir / Paiement
    expect(serviceSrc).not.toMatch(/\bDepense\b|\bAvoir\b|PaiementCotisation/);
    // Décision lot 4.0 : Depense charge autorisée ; pas d'exécution trésorerie
    expect(decisionSrc).toMatch(/depense\.create|origine:\s*"FRAIS_AVANCE"/);
    expect(decisionSrc).not.toMatch(/\bAvoir\b|UtilisationAvoir|PaiementCotisation/);
    // Choix : toujours hors Depense / Avoir / Paiement (accord seul)
    expect(choixSrc).not.toMatch(
      /\bDepense\b|\bAvoir\b|UtilisationAvoir|PaiementCotisation/
    );
  });
});
