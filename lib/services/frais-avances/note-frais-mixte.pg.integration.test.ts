/**
 * Tests PG — règlement mixte atomique (lot 4.3).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { wipeNotesFraisPgFixtures } from "@/lib/frais-avances/pg-test-wipe";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
  withCompensationsNotesFrais,
  withDecaissementsNotesFrais,
} from "@/lib/financial/synthese-charges";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";
let detteAnneeSeq = 1900;

describe("intégration PG mixte notes-frais", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    vi.resetModules();
    const url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  }, 60_000);

  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  async function wipe() {
    await wipeNotesFraisPgFixtures(prisma);
  }

  async function createUser(
    tag: string,
    role: "ADMIN" | "TRESOR" | "MEMBRE" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf-mixte-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Mixte",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function seedMixteNote(params: {
    dem: Awaited<ReturnType<typeof createUser>>;
    tres: Awaited<ReturnType<typeof createUser>>;
    libelle: string;
    montantAccepte?: number;
    montantRemb?: number;
    montantComp?: number;
    version?: number;
  }) {
    const montantAccepte = params.montantAccepte ?? 100;
    const montantRemb = params.montantRemb ?? 40;
    const montantComp = params.montantComp ?? 60;
    const version = params.version ?? 3;
    const decideeAt = new Date(Date.now() - 3600_000);
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: params.dem.adherent!.id,
        demandeurUserId: params.dem.id,
        libelle: params.libelle,
        dateDepense: new Date(),
        montantDemande: montantAccepte,
        montantAccepte,
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: params.tres.id,
        version,
      },
    });
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: params.dem.adherent!.id,
        annee: ++detteAnneeSeq,
        montant: montantComp + 20,
        montantPaye: 0,
        createdBy: params.tres.id,
      },
    });
    const choix = await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "MIXTE",
        statut: "ACTIF",
        montantReference: montantAccepte,
        montantRemboursement: montantRemb,
        montantCompensation: montantComp,
        idempotencyKey: `choix-${params.libelle}-${note.id}`.slice(0, 64),
        choisiAt: decideeAt,
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: montantComp,
              montantRestantSnapshot: montantComp + 20,
              rang: 1,
              libelleSnapshot: "Dette",
            },
          ],
        },
      },
    });
    return { note, dette, choix, decideeAt };
  }

  function mixtePayload(opts: {
    actorUserId: string;
    noteId: string;
    detteId: string;
    decideeAt: Date;
    key: string;
    expectedNoteVersion?: number;
    montantRemb?: string;
    montantComp?: string;
    moyen?: "VIREMENT" | "ESPECES";
    reference?: string;
    executeAtOffsetMs?: number;
  }) {
    return {
      actorUserId: opts.actorUserId,
      noteId: opts.noteId,
      expectedNoteVersion: opts.expectedNoteVersion ?? 3,
      idempotencyKey: opts.key,
      montantRembourse: opts.montantRemb ?? "40.00",
      moyen: opts.moyen ?? ("VIREMENT" as const),
      reference: opts.reference ?? "MIX-PG-REF",
      executeAt: new Date(
        opts.decideeAt.getTime() + (opts.executeAtOffsetMs ?? 60_000)
      ).toISOString(),
      lignesCompensation: [
        {
          typeCible: "DETTE_INITIALE" as const,
          cibleId: opts.detteId,
          montant: opts.montantComp ?? "60.00",
          rang: 1,
        },
      ],
      client: prisma,
    };
  }

  it("mixte complet : parent + 2 enfants, même executeAt, clés null enfants", async () => {
    await wipe();
    const dem = await createUser("dem", "MEMBRE");
    const tres = await createUser("tres", "TRESOR");
    const { note, dette, choix, decideeAt } = await seedMixteNote({
      dem,
      tres,
      libelle: "mixte-full",
    });
    const executeAt = new Date(decideeAt.getTime() + 60_000).toISOString();
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );
    const res = await executeNoteFraisReglementMixte({
      ...mixtePayload({
        actorUserId: tres.id,
        noteId: note.id,
        detteId: dette.id,
        decideeAt,
        key: "mixte-pg-full-01",
      }),
      executeAt,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const op = await prisma.noteFraisReglementOperation.findUniqueOrThrow({
      where: { id: res.data.operationId },
      include: { Reglements: true },
    });
    expect(op.Reglements).toHaveLength(2);
    expect(op.executeAt.toISOString()).toBe(executeAt);
    const types = op.Reglements.map((r) => r.type).sort();
    expect(types).toEqual(["COMPENSATION", "REMBOURSEMENT"]);
    for (const r of op.Reglements) {
      expect(r.idempotencyKey).toBeNull();
      expect(r.operationId).toBe(op.id);
      expect(r.executeAt.toISOString()).toBe(executeAt);
    }

    await expect(
      prisma.noteFraisReglement.create({
        data: {
          noteFraisId: note.id,
          choixId: choix.id,
          type: "COMPENSATION",
          montantTotal: 1,
          executeurUserId: tres.id,
          executeAt: new Date(),
          operationId: op.id,
          idempotencyKey: null,
        },
      })
    ).rejects.toThrow();

    const choixAfter = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    expect(choixAfter.montantRembourseUtilise.toFixed(2)).toBe("40.00");
    expect(choixAfter.montantCompensationUtilise.toFixed(2)).toBe("60.00");
    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfter.version).toBe(4);

    const base = computeChargesFromDepensesValides([
      { montant: 100, origine: "FRAIS_AVANCE" },
    ]);
    const ind = withDecaissementsNotesFrais(
      withCompensationsNotesFrais(base, 60),
      40
    );
    expect(ind.compensationsNotesFrais).toBe(60);
    expect(ind.decaissementsNotesFrais).toBe(40);
    expect(computeSoldeBancaireEstime(200, ind)).toBe(160);

    const outboxes = await prisma.noteFraisOutboxEvent.findMany({
      where: { noteFraisId: note.id },
    });
    expect(outboxes).toHaveLength(1);
    expect(outboxes[0]!.kind).toBe("REGLEMENT_MIXTE");
    expect(outboxes[0]!.eventKey).toBe(
      `note:${note.id}:operation:${res.data.operationId}:mixte`
    );
    expect(JSON.stringify(outboxes[0]!.payload)).not.toMatch(
      /40\.00|60\.00|VIREMENT|VIR-/i
    );
    const notifs = await prisma.notification.findMany({
      where: {
        userId: dem.id,
        lien: `/user/frais-avances/${note.id}`,
        titre: "Règlement enregistré",
      },
    });
    expect(notifs).toHaveLength(1);
    // Aucun outbox ancré sur les enfants
    for (const child of op.Reglements) {
      expect(
        await prisma.noteFraisOutboxEvent.count({
          where: { eventKey: { contains: child.id } },
        })
      ).toBe(0);
    }
  }, 60_000);

  it("idempotence parent : même clé + contenu, replay version, conflits, FORBIDDEN, P2002", async () => {
    await wipe();
    const dem = await createUser("dem-idemp", "MEMBRE");
    const tres = await createUser("tres-idemp", "TRESOR");
    const admin = await createUser("admin-idemp", "ADMIN");
    const membre = await createUser("mem-idemp", "MEMBRE");
    const { note, dette, decideeAt } = await seedMixteNote({
      dem,
      tres,
      libelle: "mixte-idemp",
    });
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );
    const key = "mixte-pg-idemp-01";
    const payload = mixtePayload({
      actorUserId: tres.id,
      noteId: note.id,
      detteId: dette.id,
      decideeAt,
      key,
    });

    const first = await executeNoteFraisReglementMixte(payload);
    expect(first.success).toBe(true);
    if (!first.success) return;

    const notifAfterFirst = await prisma.notification.count({
      where: {
        userId: dem.id,
        lien: `/user/frais-avances/${note.id}`,
        titre: "Règlement enregistré",
      },
    });
    const outboxAfterFirst = await prisma.noteFraisOutboxEvent.count({
      where: { noteFraisId: note.id, kind: "REGLEMENT_MIXTE" },
    });
    expect(notifAfterFirst).toBe(1);
    expect(outboxAfterFirst).toBe(1);

    const second = await executeNoteFraisReglementMixte({
      ...payload,
      actorUserId: admin.id,
      expectedNoteVersion: 3, // ancienne version — replay sans mutation
    });
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.alreadyExecuted).toBe(true);
      expect(second.data.operationId).toBe(first.data.operationId);
    }
    expect(
      await prisma.noteFraisReglementOperation.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(2);
    const noteAfterReplay = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfterReplay.version).toBe(4);
    expect(
      await prisma.notification.count({
        where: {
          userId: dem.id,
          lien: `/user/frais-avances/${note.id}`,
          titre: "Règlement enregistré",
        },
      })
    ).toBe(notifAfterFirst);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "REGLEMENT_MIXTE" },
      })
    ).toBe(outboxAfterFirst);

    const conflictContent = await executeNoteFraisReglementMixte({
      ...payload,
      montantRembourse: "39.00",
      lignesCompensation: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: "61.00",
          rang: 1,
        },
      ],
    });
    expect(conflictContent.success).toBe(false);
    if (!conflictContent.success) {
      expect(conflictContent.code).toBe("IDEMPOTENCY_CONFLICT");
    }

    const other = await seedMixteNote({
      dem,
      tres,
      libelle: "mixte-other-note",
      montantAccepte: 50,
      montantRemb: 20,
      montantComp: 30,
    });
    const conflictOtherNote = await executeNoteFraisReglementMixte(
      mixtePayload({
        actorUserId: tres.id,
        noteId: other.note.id,
        detteId: other.dette.id,
        decideeAt: other.decideeAt,
        key,
        montantRemb: "20.00",
        montantComp: "30.00",
        reference: "OTHER-NOTE-REF",
      })
    );
    expect(conflictOtherNote.success).toBe(false);
    if (!conflictOtherNote.success) {
      expect(conflictOtherNote.code).toBe("IDEMPOTENCY_CONFLICT");
    }

    const forbiddenMembre = await executeNoteFraisReglementMixte({
      ...payload,
      actorUserId: membre.id,
    });
    expect(forbiddenMembre.success).toBe(false);
    if (!forbiddenMembre.success) expect(forbiddenMembre.code).toBe("FORBIDDEN");

    const forbiddenDemandeur = await executeNoteFraisReglementMixte({
      ...payload,
      actorUserId: dem.id,
    });
    expect(forbiddenDemandeur.success).toBe(false);
    if (!forbiddenDemandeur.success) {
      expect(
        ["FORBIDDEN", "AUTO_EXECUTION_FORBIDDEN"].includes(
          forbiddenDemandeur.code ?? ""
        )
      ).toBe(true);
    }

    // P2002 parent même clé : concurrence déterministe → relecture + authz
    const race = await seedMixteNote({
      dem,
      tres,
      libelle: "mixte-p2002",
      montantAccepte: 80,
      montantRemb: 30,
      montantComp: 50,
    });
    const raceKey = "mixte-pg-p2002-key";
    let releaseBoth!: () => void;
    const go = new Promise<void>((r) => {
      releaseBoth = r;
    });
    let signal1!: () => void;
    let signal2!: () => void;
    const bothAtLock = Promise.all([
      new Promise<void>((r) => {
        signal1 = r;
      }),
      new Promise<void>((r) => {
        signal2 = r;
      }),
    ]);
    const p1 = executeNoteFraisReglementMixte({
      ...mixtePayload({
        actorUserId: tres.id,
        noteId: race.note.id,
        detteId: race.dette.id,
        decideeAt: race.decideeAt,
        key: raceKey,
        montantRemb: "30.00",
        montantComp: "50.00",
        reference: "P2002-REF",
      }),
      beforeDemandeurLock: async () => {
        signal1();
        await go;
      },
    });
    const p2 = executeNoteFraisReglementMixte({
      ...mixtePayload({
        actorUserId: admin.id,
        noteId: race.note.id,
        detteId: race.dette.id,
        decideeAt: race.decideeAt,
        key: raceKey,
        montantRemb: "30.00",
        montantComp: "50.00",
        reference: "P2002-REF",
      }),
      beforeDemandeurLock: async () => {
        signal2();
        await go;
      },
    });
    await bothAtLock;
    releaseBoth();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.success && r2.success).toBe(true);
    const already = [r1, r2].filter(
      (r) => r.success && r.data.alreadyExecuted
    );
    const fresh = [r1, r2].filter(
      (r) => r.success && !r.data.alreadyExecuted
    );
    expect(fresh.length + already.length).toBe(2);
    expect(
      await prisma.noteFraisReglementOperation.count({
        where: { noteFraisId: race.note.id },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisReglement.count({
        where: { noteFraisId: race.note.id },
      })
    ).toBe(2);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: race.note.id,
          kind: "REGLEMENT_MIXTE",
        },
      })
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: {
          userId: dem.id,
          lien: `/user/frais-avances/${race.note.id}`,
          titre: "Règlement enregistré",
        },
      })
    ).toBe(1);
  }, 90_000);

  it("concurrence mixte : deux clés, une seule réussite, une compensation, un décaissement", async () => {
    await wipe();
    const dem = await createUser("dem-race", "MEMBRE");
    const t1 = await createUser("tres-race-a", "TRESOR");
    const t2 = await createUser("admin-race-b", "ADMIN");
    const { note, dette, choix, decideeAt } = await seedMixteNote({
      dem,
      tres: t1,
      libelle: "mixte-race",
    });
    const detteBefore = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );

    let releaseBoth!: () => void;
    const go = new Promise<void>((r) => {
      releaseBoth = r;
    });
    let signal1!: () => void;
    let signal2!: () => void;
    const bothAtLock = Promise.all([
      new Promise<void>((r) => {
        signal1 = r;
      }),
      new Promise<void>((r) => {
        signal2 = r;
      }),
    ]);

    const common = {
      noteId: note.id,
      detteId: dette.id,
      decideeAt,
      montantRemb: "40.00",
      montantComp: "60.00",
      reference: "RACE-REF",
    };

    const p1 = executeNoteFraisReglementMixte({
      ...mixtePayload({
        ...common,
        actorUserId: t1.id,
        key: "mixte-race-key-a",
      }),
      beforeDemandeurLock: async () => {
        signal1();
        await go;
      },
    });
    const p2 = executeNoteFraisReglementMixte({
      ...mixtePayload({
        ...common,
        actorUserId: t2.id,
        key: "mixte-race-key-b",
      }),
      beforeDemandeurLock: async () => {
        signal2();
        await go;
      },
    });
    await bothAtLock;
    releaseBoth();
    const [a, b] = await Promise.all([p1, p2]);
    const ok = [a, b].filter((r) => r.success);
    const fail = [a, b].filter((r) => !r.success);
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    if (!fail[0]!.success) {
      expect(
        ["VERSION_CONFLICT", "REFRESH_REQUIRED"].includes(fail[0]!.code ?? "")
      ).toBe(true);
    }

    expect(
      await prisma.noteFraisReglementOperation.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(2);

    const choixAfter = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    expect(choixAfter.montantRembourseUtilise.toFixed(2)).toBe("40.00");
    expect(choixAfter.montantCompensationUtilise.toFixed(2)).toBe("60.00");

    const cible = await prisma.noteFraisChoixReglementCible.findFirstOrThrow({
      where: { choixId: choix.id },
    });
    expect(cible.montantUtilise.toFixed(2)).toBe("60.00");

    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    expect(detteAfter.montantPaye.toFixed(2)).toBe(
      detteBefore.montantPaye.add(60).toFixed(2)
    );

    const rembs = await prisma.noteFraisReglement.findMany({
      where: { noteFraisId: note.id, type: "REMBOURSEMENT" },
    });
    expect(rembs).toHaveLength(1);
    expect(rembs[0]!.montantTotal.toFixed(2)).toBe("40.00");

    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfter.version).toBe(4);

    expect(choixAfter.montantRembourseUtilise.lte(choixAfter.montantRemboursement)).toBe(
      true
    );
    expect(
      choixAfter.montantCompensationUtilise.lte(choixAfter.montantCompensation)
    ).toBe(true);
  }, 90_000);

  it("rollback afterBothChildren : zéro parent/enfants/avoir, soldes et version inchangés", async () => {
    await wipe();
    const dem = await createUser("dem-rb", "MEMBRE");
    const tres = await createUser("tres-rb", "TRESOR");
    const { note, dette, choix, decideeAt } = await seedMixteNote({
      dem,
      tres,
      libelle: "mixte-after-both",
      montantAccepte: 50,
      montantRemb: 20,
      montantComp: 30,
    });
    const detteBefore = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    const choixBefore = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    const cibleBefore = await prisma.noteFraisChoixReglementCible.findFirstOrThrow(
      {
        where: { choixId: choix.id },
      }
    );
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );

    const fail = await executeNoteFraisReglementMixte({
      ...mixtePayload({
        actorUserId: tres.id,
        noteId: note.id,
        detteId: dette.id,
        decideeAt,
        key: "mixte-pg-after-both",
        montantRemb: "20.00",
        montantComp: "30.00",
        reference: "AFTER-BOTH",
      }),
      afterBothChildren: async () => {
        throw new Error("forced-rollback-after-both-children");
      },
    });
    expect(fail.success).toBe(false);

    expect(
      await prisma.noteFraisReglementOperation.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(0);
    expect(
      await prisma.noteFraisReglementLigne.count({
        where: { Reglement: { noteFraisId: note.id } },
      })
    ).toBe(0);
    expect(
      await prisma.avoir.count({
        where: { origine: "COMPENSATION_NOTE_FRAIS" },
      })
    ).toBe(0);
    expect(
      await prisma.utilisationAvoir.count({
        where: { noteFraisReglementLigneId: { not: null } },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(0);
    expect(
      await prisma.notification.count({
        where: { lien: `/user/frais-avances/${note.id}` },
      })
    ).toBe(0);

    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    expect(detteAfter.montantPaye.toFixed(2)).toBe(
      detteBefore.montantPaye.toFixed(2)
    );
    expect(detteAfter.montantRestant.toFixed(2)).toBe(
      detteBefore.montantRestant.toFixed(2)
    );

    const choixAfter = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    expect(choixAfter.montantRembourseUtilise.toFixed(2)).toBe(
      choixBefore.montantRembourseUtilise.toFixed(2)
    );
    expect(choixAfter.montantCompensationUtilise.toFixed(2)).toBe(
      choixBefore.montantCompensationUtilise.toFixed(2)
    );

    const cibleAfter = await prisma.noteFraisChoixReglementCible.findFirstOrThrow(
      {
        where: { choixId: choix.id },
      }
    );
    expect(cibleAfter.montantUtilise.toFixed(2)).toBe(
      cibleBefore.montantUtilise.toFixed(2)
    );

    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfter.version).toBe(3);

    const base = computeChargesFromDepensesValides([]);
    const ind = withDecaissementsNotesFrais(
      withCompensationsNotesFrais(base, 0),
      0
    );
    expect(ind.compensationsNotesFrais).toBe(0);
    expect(ind.decaissementsNotesFrais).toBe(0);
  }, 60_000);

  it("rollback afterNotifyOutbox : zéro finance, notification et outbox", async () => {
    await wipe();
    const dem = await createUser("dem-nf", "MEMBRE");
    const tres = await createUser("tres-nf", "TRESOR");
    const { note, dette, decideeAt } = await seedMixteNote({
      dem,
      tres,
      libelle: "mixte-after-notify",
      montantAccepte: 50,
      montantRemb: 20,
      montantComp: 30,
    });
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );

    const fail = await executeNoteFraisReglementMixte({
      ...mixtePayload({
        actorUserId: tres.id,
        noteId: note.id,
        detteId: dette.id,
        decideeAt,
        key: "mixte-pg-after-notify",
        montantRemb: "20.00",
        montantComp: "30.00",
        reference: "AFTER-NOTIFY",
      }),
      afterNotifyOutbox: async () => {
        throw new Error("forced-rollback-after-notify-outbox");
      },
    });
    expect(fail.success).toBe(false);

    expect(
      await prisma.noteFraisReglementOperation.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(0);
    expect(
      await prisma.avoir.count({
        where: { origine: "COMPENSATION_NOTE_FRAIS" },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(0);
    expect(
      await prisma.notification.count({
        where: { lien: `/user/frais-avances/${note.id}` },
      })
    ).toBe(0);
    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfter.version).toBe(3);
  }, 60_000);

  it("parent incomplet → NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE sans mutation", async () => {
    await wipe();
    const dem = await createUser("dem-inc", "MEMBRE");
    const tres = await createUser("tres-inc", "TRESOR");
    const { note, dette, choix, decideeAt } = await seedMixteNote({
      dem,
      tres,
      libelle: "mixte-incomplete",
    });
    const key = "mixte-pg-incomplete-01";
    const executeAt = new Date(decideeAt.getTime() + 60_000);
    const op = await prisma.noteFraisReglementOperation.create({
      data: {
        noteFraisId: note.id,
        choixId: choix.id,
        executeurUserId: tres.id,
        executeAt,
        idempotencyKey: key,
      },
    });
    // Un seul enfant REMBOURSEMENT — parent corrompu / incomplet
    await prisma.noteFraisReglement.create({
      data: {
        noteFraisId: note.id,
        choixId: choix.id,
        type: "REMBOURSEMENT",
        montantTotal: 40,
        moyen: "VIREMENT",
        reference: "INC-REF",
        referenceNormalisee: "INC-REF",
        executeurUserId: tres.id,
        executeAt,
        operationId: op.id,
        idempotencyKey: null,
      },
    });

    const versionBefore = (
      await prisma.noteFrais.findUniqueOrThrow({ where: { id: note.id } })
    ).version;
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );
    const res = await executeNoteFraisReglementMixte(
      mixtePayload({
        actorUserId: tres.id,
        noteId: note.id,
        detteId: dette.id,
        decideeAt,
        key,
        reference: "INC-REF",
      })
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE");
    }
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(1);
    expect(
      await prisma.noteFraisReglementOperation.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(1);
    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfter.version).toBe(versionBefore);
    const choixAfter = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    expect(choixAfter.montantRembourseUtilise.toFixed(2)).toBe("0.00");
    expect(choixAfter.montantCompensationUtilise.toFixed(2)).toBe("0.00");
  }, 60_000);
});
