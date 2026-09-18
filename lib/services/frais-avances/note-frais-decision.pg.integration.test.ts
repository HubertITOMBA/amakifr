/**
 * Tests PG — décision notes de frais (lots 2 + 4.0 charge).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { wipeNotesFraisPgFixtures } from "@/lib/frais-avances/pg-test-wipe";
import { ensureTypeDepenseFraisAvanceForTests } from "@/lib/frais-avances/type-depense-frais-avance";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
} from "@/lib/financial/synthese-charges";

const STORAGE = "/tmp/amaki-notes-frais-pg-decision-storage";
const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

describe("intégration PG décision notes-frais", () => {
  let prisma: PrismaClient;
  let url: string;
  let typeSeedUserId: string;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    process.env.NOTES_FRAIS_STORAGE_ROOT = STORAGE;
    vi.resetModules();
    url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    await mkdir(STORAGE, { recursive: true });
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
    role: "ADMIN" | "TRESOR" | "PRESID" | "SECRET" | "COMCPT" | "MEMBRE",
    status: "Actif" | "Inactif" = "Actif"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    const email = `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`;
    return prisma.user.create({
      data: {
        id,
        email,
        name: `nf-dec-${tag}-${id}`,
        role,
        status,
        password: "x",
        adherent: {
          create: {
            firstname: "Dec",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function ensureTypeFa() {
    const seed = await createUser("typeseed", "ADMIN");
    typeSeedUserId = seed.id;
    return ensureTypeDepenseFraisAvanceForTests(prisma, seed.id);
  }

  async function createSubmittedNote(
    user: Awaited<ReturnType<typeof createUser>>,
    montant = 80
  ) {
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: user.adherent!.id,
        demandeurUserId: user.id,
        libelle: "Note décision PG",
        dateDepense: new Date("2026-03-01"),
        montantDemande: montant,
        statut: "SOUMISE",
        soumiseAt: new Date(),
        submitIdempotencyKey: `sub-${randomUUID().slice(0, 12)}`,
        version: 2,
      },
    });
    const rel = `notes/${note.id}/j.pdf`;
    const abs = path.join(STORAGE, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from("%PDF-1.4 dec"), { mode: 0o600 });
    await prisma.justificatifNoteFrais.create({
      data: {
        noteFraisId: note.id,
        nomFichierOrig: "j.pdf",
        cheminRelatif: rel,
        typeMime: "application/pdf",
        taille: 12,
        statut: "READY",
        uploadedBy: user.id,
      },
    });
    return note;
  }

  it("validation totale : journal + Depense FRAIS_AVANCE + notif + outbox", async () => {
    await wipe();
    const typeFa = await ensureTypeFa();
    const dem = await createUser("dem", "MEMBRE");
    const tres = await createUser("tres", "TRESOR");
    const note = await createSubmittedNote(dem, 80);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const res = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-ok-total-01",
      outcome: "VALIDEE",
      montantAccepte: 80,
      client: prisma,
    });
    expect(res.success).toBe(true);

    const updated = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
      include: { Decision: true, DepenseCharge: true },
    });
    expect(updated.statut).toBe("VALIDEE");
    expect(updated.Decision?.statutFinal).toBe("VALIDEE");
    expect(Number(updated.montantAccepte)).toBe(80);

    expect(updated.DepenseCharge).not.toBeNull();
    expect(updated.DepenseCharge!.origine).toBe("FRAIS_AVANCE");
    expect(updated.DepenseCharge!.noteFraisId).toBe(note.id);
    expect(updated.DepenseCharge!.typeDepenseId).toBe(typeFa.id);
    expect(Number(updated.DepenseCharge!.montant)).toBe(80);
    expect(updated.DepenseCharge!.statut).toBe("Valide");
    expect(updated.DepenseCharge!.createdBy).toBe(tres.id);
    expect(updated.DepenseCharge!.validatedBy).toBe(tres.id);
    expect(updated.DepenseCharge!.dateDepense.toISOString()).toBe(
      note.dateDepense.toISOString()
    );

    expect(
      await prisma.depense.count({ where: { noteFraisId: note.id } })
    ).toBe(1);

    const notifs = await prisma.notification.findMany({
      where: { userId: dem.id, lien: `/user/frais-avances/${note.id}` },
    });
    expect(notifs).toHaveLength(1);

    const outbox = await prisma.noteFraisOutboxEvent.findMany({
      where: { eventKey: `note:${note.id}:decided` },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.kind).toBe("DECIDED");

    // Aucune écriture Avoir / UtilisationAvoir / PaiementCotisation
    expect(await prisma.avoir.count({ where: { adherentId: dem.adherent!.id } })).toBe(0);
    expect(
      await prisma.paiementCotisation.count({
        where: { adherentId: dem.adherent!.id },
      })
    ).toBe(0);
  });

  it("validation partielle : Depense = montantAccepte", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demp", "MEMBRE");
    const tres = await createUser("tresp", "TRESOR");
    const note = await createSubmittedNote(dem, 100);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const res = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-partiel-01",
      outcome: "VALIDEE",
      montantAccepte: 55.5,
      motif: "Partiel justifié",
      client: prisma,
    });
    expect(res.success).toBe(true);
    const dep = await prisma.depense.findUniqueOrThrow({
      where: { noteFraisId: note.id },
    });
    expect(Number(dep.montant)).toBe(55.5);
    expect(dep.origine).toBe("FRAIS_AVANCE");
  });

  it("rejet : zéro Depense", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demrej0", "MEMBRE");
    const tres = await createUser("tresrej0", "TRESOR");
    const note = await createSubmittedNote(dem, 40);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const res = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-rej-zero",
      outcome: "REJETEE",
      motif: "Illisible",
      client: prisma,
    });
    expect(res.success).toBe(true);
    expect(await prisma.depense.count({ where: { noteFraisId: note.id } })).toBe(
      0
    );
  });

  it("TypeDepense absent/inactif : rollback note, décision, notif, outbox, Depense", async () => {
    await wipe();
    const dem = await createUser("demnotype", "MEMBRE");
    const tres = await createUser("tresnotype", "TRESOR");
    const note = await createSubmittedNote(dem, 25);

    // Désactive tout TypeDepense FRAIS_AVANCE s'il existe
    await prisma.typeDepense.updateMany({
      where: { code: "FRAIS_AVANCE" },
      data: { actif: false },
    });

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const res = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-no-type-pg",
      outcome: "VALIDEE",
      montantAccepte: 25,
      client: prisma,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("TYPE_DEPENSE_FRAIS_AVANCE_ABSENT");
    }

    const still = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(still.statut).toBe("SOUMISE");
    expect(
      await prisma.noteFraisDecision.count({ where: { noteFraisId: note.id } })
    ).toBe(0);
    expect(await prisma.depense.count({ where: { noteFraisId: note.id } })).toBe(
      0
    );
    expect(
      await prisma.notification.count({
        where: { userId: dem.id, lien: `/user/frais-avances/${note.id}` },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { eventKey: `note:${note.id}:decided` },
      })
    ).toBe(0);

    // Restaure type pour les autres tests
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
  });

  it("replay idempotent : une seule Depense", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demid", "MEMBRE");
    const tres = await createUser("tresid", "TRESOR");
    const note = await createSubmittedNote(dem, 33);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const first = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-idem-dep",
      outcome: "VALIDEE",
      montantAccepte: 33,
      client: prisma,
    });
    expect(first.success).toBe(true);

    const second = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-idem-dep",
      outcome: "VALIDEE",
      montantAccepte: 33,
      client: prisma,
    });
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.alreadyDecided).toBe(true);
    expect(await prisma.depense.count({ where: { noteFraisId: note.id } })).toBe(
      1
    );
  });

  it("deux décisions concurrentes : une seule Depense", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demc", "MEMBRE");
    const t1 = await createUser("t1", "TRESOR");
    const t2 = await createUser("t2", "ADMIN");
    const note = await createSubmittedNote(dem, 50);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );

    const [r1, r2] = await Promise.all([
      decideNoteFrais({
        actorUserId: t1.id,
        noteId: note.id,
        expectedVersion: 2,
        idempotencyKey: "decide-race-a",
        outcome: "VALIDEE",
        montantAccepte: 50,
        client: prisma,
      }),
      decideNoteFrais({
        actorUserId: t2.id,
        noteId: note.id,
        expectedVersion: 2,
        idempotencyKey: "decide-race-b",
        outcome: "REJETEE",
        motif: "trop tard",
        client: prisma,
      }),
    ]);

    const successes = [r1, r2].filter((r) => r.success);
    const failures = [r1, r2].filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const final = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(["VALIDEE", "REJETEE"]).toContain(final.statut);
    expect(
      await prisma.noteFraisDecision.count({ where: { noteFraisId: note.id } })
    ).toBe(1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { eventKey: `note:${note.id}:decided` },
      })
    ).toBe(1);

    const depCount = await prisma.depense.count({
      where: { noteFraisId: note.id },
    });
    if (final.statut === "VALIDEE") {
      expect(depCount).toBe(1);
    } else {
      expect(depCount).toBe(0);
    }
  });

  it("synthèse : charge FRAIS_AVANCE ↑ ; solde inchangé ; ORDINAIRE ↓ solde", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demsyn", "MEMBRE");
    const tres = await createUser("tressyn", "TRESOR");
    const note = await createSubmittedNote(dem, 70);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-syn-fa",
      outcome: "VALIDEE",
      montantAccepte: 70,
      client: prisma,
    });

    const ord = await prisma.depense.create({
      data: {
        libelle: "Ordinaire test",
        montant: 20,
        dateDepense: new Date("2026-01-15"),
        statut: "Valide",
        origine: "ORDINAIRE",
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });

    const all = await prisma.depense.findMany({
      where: {
        OR: [{ id: ord.id }, { noteFraisId: note.id }],
        statut: "Valide",
      },
    });
    // Classification par origine uniquement (pas noteFraisId)
    const ind = computeChargesFromDepensesValides(
      all.map((d) => ({ montant: Number(d.montant), origine: d.origine }))
    );
    expect(ind.totalCharges).toBe(90);
    expect(ind.depensesOrdinairesDecaissees).toBe(20);
    expect(computeSoldeBancaireEstime(100, ind)).toBe(80);

    await prisma.depense.delete({ where: { id: ord.id } });
  });

  it("historique : Depense sans origine explicite = ORDINAIRE (défaut)", async () => {
    await wipe();
    const tres = await createUser("tresdef", "TRESOR");
    const d = await prisma.depense.create({
      data: {
        libelle: "Sans origine explicite",
        montant: 5,
        dateDepense: new Date(),
        statut: "Valide",
        createdBy: tres.id,
      },
    });
    const loaded = await prisma.depense.findUniqueOrThrow({ where: { id: d.id } });
    expect(loaded.origine).toBe("ORDINAIRE");
    expect(loaded.noteFraisId).toBeNull();
    await prisma.depense.delete({ where: { id: d.id } });
  });

  it("Restrict : suppression note bloquée tant que Depense liée", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demrest", "MEMBRE");
    const tres = await createUser("tresrest", "TRESOR");
    const note = await createSubmittedNote(dem, 12);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-restrict",
      outcome: "VALIDEE",
      montantAccepte: 12,
      client: prisma,
    });

    await expect(
      prisma.noteFrais.delete({ where: { id: note.id } })
    ).rejects.toThrow();
  });

  it("rollback TX si échec après claim : note reste SOUMISE", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demr", "MEMBRE");
    const tres = await createUser("tresr", "TRESOR");
    const note = await createSubmittedNote(dem, 30);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );

    await prisma.noteFraisOutboxEvent.create({
      data: {
        noteFraisId: note.id,
        eventKey: `note:${note.id}:decided`,
        kind: "DECIDED",
        payload: {},
        status: "DONE",
      },
    });

    const res = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-rollback-01",
      outcome: "VALIDEE",
      montantAccepte: 30,
      client: prisma,
    });
    expect(res.success).toBe(false);

    const still = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(still.statut).toBe("SOUMISE");
    expect(await prisma.noteFraisDecision.count({ where: { noteFraisId: note.id } })).toBe(0);
    expect(await prisma.depense.count({ where: { noteFraisId: note.id } })).toBe(
      0
    );
    expect(
      await prisma.notification.count({
        where: { userId: dem.id, lien: `/user/frais-avances/${note.id}` },
      })
    ).toBe(0);
  });

  it("rôles : additionnel TRESOR OK ; PRESID/inactif/auto refusés", async () => {
    await wipe();
    await ensureTypeFa();
    const dem = await createUser("demrole", "MEMBRE");
    const membre = await createUser("membrole", "MEMBRE");
    await prisma.userAdminRole.create({
      data: { userId: membre.id, role: "TRESOR", createdBy: dem.id },
    });
    const presid = await createUser("pres", "PRESID");
    const inactive = await createUser("inact", "TRESOR", "Inactif");
    const note = await createSubmittedNote(dem, 20);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );

    const ok = await decideNoteFrais({
      actorUserId: membre.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-add-tresor",
      outcome: "VALIDEE",
      montantAccepte: 20,
      client: prisma,
    });
    expect(ok.success).toBe(true);
    expect(await prisma.depense.count({ where: { noteFraisId: note.id } })).toBe(
      1
    );

    const note2 = await createSubmittedNote(dem, 21);
    const badPres = await decideNoteFrais({
      actorUserId: presid.id,
      noteId: note2.id,
      expectedVersion: 2,
      idempotencyKey: "decide-pres-no",
      outcome: "VALIDEE",
      montantAccepte: 21,
      client: prisma,
    });
    expect(badPres.success).toBe(false);

    const badInact = await decideNoteFrais({
      actorUserId: inactive.id,
      noteId: note2.id,
      expectedVersion: 2,
      idempotencyKey: "decide-inact-no",
      outcome: "VALIDEE",
      montantAccepte: 21,
      client: prisma,
    });
    expect(badInact.success).toBe(false);

    const auto = await decideNoteFrais({
      actorUserId: dem.id,
      noteId: note2.id,
      expectedVersion: 2,
      idempotencyKey: "decide-auto-no",
      outcome: "VALIDEE",
      montantAccepte: 21,
      client: prisma,
    });
    expect(auto.success).toBe(false);
    if (!auto.success) expect(auto.code).toBe("AUTO_DECISION_FORBIDDEN");
  });

  it("REJETEE immuable + correction + RGPD refuse sans politique ACTIVE", async () => {
    await wipe();
    await prisma.noteFraisRetentionPolicyVersion.deleteMany({});
    await ensureTypeFa();
    const dem = await createUser("demrej", "MEMBRE");
    const tres = await createUser("tresrej", "TRESOR");
    const note = await createSubmittedNote(dem, 15);

    const {
      decideNoteFrais,
      createCorrectedNoteFraisDraft,
    } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const { deleteUserAtomicallyWithNotesFraisRgpd } = await import(
      "@/lib/services/frais-avances/rgpd-account-deletion"
    );

    const rej = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-reject-01",
      outcome: "REJETEE",
      motif: "Pièce illisible",
      client: prisma,
    });
    expect(rej.success).toBe(true);
    expect(await prisma.depense.count({ where: { noteFraisId: note.id } })).toBe(
      0
    );

    const corr = await createCorrectedNoteFraisDraft({
      userId: dem.id,
      corrigeNoteFraisId: note.id,
      client: prisma,
    });
    expect(corr.success).toBe(true);
    if (corr.success) {
      const draft = await prisma.noteFrais.findUniqueOrThrow({
        where: { id: corr.data.id },
      });
      expect(draft.statut).toBe("BROUILLON");
      expect(draft.corrigeNoteFraisId).toBe(note.id);
    }

    await expect(
      deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma)
    ).rejects.toMatchObject({ code: "NOTES_FRAIS_SUBMITTED_RETENTION_REQUIRED" });

    await deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma, {
      injectedRetention: { durationMs: 60_000, startsAt: "archivedAt" },
    });
    expect(await prisma.noteFrais.count({ where: { demandeurUserId: dem.id } })).toBe(0);
    const arch = await prisma.noteFraisArchive.findFirst({
      where: { statutFinal: "REJETEE" },
    });
    expect(arch).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: dem.id } })).toBeNull();
  });

  // silence unused
  void typeSeedUserId;
});
