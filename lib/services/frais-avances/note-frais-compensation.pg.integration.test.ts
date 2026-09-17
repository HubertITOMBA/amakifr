/**
 * Tests PG — compensation notes de frais (lot 4.1).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { ensureTypeDepenseFraisAvanceForTests } from "@/lib/frais-avances/type-depense-frais-avance";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
  withCompensationsNotesFrais,
} from "@/lib/financial/synthese-charges";
import { appliquerAvoirs } from "@/lib/services/paiements/avoir-allocation";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

describe("intégration PG compensation notes-frais", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    vi.resetModules();
    const url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();

    const generated = await prisma.$queryRaw<
      Array<{ is_generated: string; generation_expression: string | null }>
    >`
      SELECT is_generated, generation_expression
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'dettes_initiales'
        AND column_name = 'montantRestant'
    `;
    expect(generated).toHaveLength(1);
    expect(generated[0]!.is_generated).toBe("ALWAYS");
    expect(generated[0]!.generation_expression?.replace(/\s+/g, " ").trim()).toBe(
      '(montant - "montantPaye")'
    );
  }, 60_000);

  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  async function wipe() {
    await prisma.utilisationAvoir.deleteMany({
      where: { noteFraisReglementLigneId: { not: null } },
    });
    await prisma.avoir.deleteMany({
      where: {
        OR: [
          { noteFraisReglementLigneId: { not: null } },
          { origine: "COMPENSATION_NOTE_FRAIS" },
        ],
      },
    });
    await prisma.noteFraisReglementLigne.deleteMany({});
    await prisma.noteFraisReglement.deleteMany({});
    await prisma.noteFraisReglementOperation.deleteMany({});
    await prisma.depense.deleteMany({ where: { noteFraisId: { not: null } } });
    await prisma.noteFraisChoixReglementCible.deleteMany({});
    await prisma.noteFraisChoixReglement.deleteMany({});
    await prisma.noteFraisDecision.deleteMany({});
    await prisma.noteFraisOutboxEvent.deleteMany({});
    await prisma.justificatifNoteFrais.deleteMany({});
    await prisma.noteFrais.deleteMany({});
    await prisma.cotisationMensuelle.deleteMany({
      where: {
        Adherent: { User: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
      },
    });
    await prisma.detteInitiale.deleteMany({
      where: {
        Adherent: { User: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
      },
    });
    await prisma.typeCotisationMensuelle.deleteMany({
      where: { nom: { startsWith: "nf-comp-" } },
    });
    await prisma.userAdminRole.deleteMany({
      where: { user: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } },
    });
  }

  async function createUser(
    tag: string,
    role: "ADMIN" | "TRESOR" | "MEMBRE" | "PRESID" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf-comp-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Comp",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  it("COMPENSATION dette+CM ; XOR ; générée DetteInitiale ; jamais FIFO", async () => {
    await wipe();
    const demR = await createUser("demR", "MEMBRE");
    const tresR = await createUser("tresR", "TRESOR");
    await ensureTypeDepenseFraisAvanceForTests(prisma, tresR.id);
    const detteR = await prisma.detteInitiale.create({
      data: {
        adherentId: demR.adherent!.id,
        annee: 2024,
        montant: 100,
        montantPaye: 20,
        createdBy: tresR.id,
      },
    });
    expect(Number(detteR.montantRestant)).toBe(80);

    const typeCmR = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-comp-ord2-${randomUUID().slice(0, 6)}`,
        montant: 50,
        categorie: "ForfaitMensuel",
        createdBy: tresR.id,
      },
    });
    const cmR = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-02",
        annee: 2026,
        mois: 2,
        typeCotisationId: typeCmR.id,
        adherentId: demR.adherent!.id,
        montantAttendu: 50,
        montantPaye: 0,
        montantRestant: 50,
        dateEcheance: new Date("2026-02-28"),
        statut: "EnAttente",
        createdBy: tresR.id,
      },
    });
    const noteR = await prisma.noteFrais.create({
      data: {
        adherentId: demR.adherent!.id,
        demandeurUserId: demR.id,
        libelle: "Comp dette+cm",
        dateDepense: new Date("2026-04-01"),
        montantDemande: 60,
        montantAccepte: 60,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tresR.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "c",
        montant: 60,
        dateDepense: noteR.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: noteR.id,
        createdBy: tresR.id,
        validatedBy: tresR.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: noteR.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 60,
        montantCompensation: 60,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: detteR.id,
              montantAutorise: 30,
              montantRestantSnapshot: 80,
              rang: 1,
            },
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cmR.id,
              montantAutorise: 30,
              montantRestantSnapshot: 50,
              rang: 2,
            },
          ],
        },
      },
    });

    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );
    const { Prisma } = await import("@prisma/client");
    const notifBefore = await prisma.notification.count();
    const outboxBefore = await prisma.noteFraisOutboxEvent.count();
    const payBefore = await prisma.paiementCotisation.count();
    const depBefore = await prisma.depense.count({
      where: { noteFraisId: noteR.id },
    });

    const res = await executeNoteFraisCompensation({
      actorUserId: tresR.id,
      noteId: noteR.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-dette-cm-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: detteR.id,
          montant: 30,
          rang: 1,
        },
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cmR.id,
          montant: 30,
          rang: 2,
        },
      ],
      client: prisma,
    });
    expect(res.success).toBe(true);

    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: detteR.id },
    });
    expect(Number(detteAfter.montantPaye)).toBe(50);
    expect(Number(detteAfter.montantRestant)).toBe(50);

    const cmAfter = await prisma.cotisationMensuelle.findUniqueOrThrow({
      where: { id: cmR.id },
    });
    expect(Number(cmAfter.montantPaye)).toBe(30);
    expect(Number(cmAfter.montantRestant)).toBe(20);
    expect(cmAfter.statut).toBe("PartiellementPaye");

    const avoirs = await prisma.avoir.findMany({
      where: {
        adherentId: demR.adherent!.id,
        origine: "COMPENSATION_NOTE_FRAIS",
      },
      include: { Utilisations: true },
    });
    expect(avoirs).toHaveLength(2);
    for (const a of avoirs) {
      expect(a.statut).toBe("Utilise");
      expect(Number(a.montantRestant)).toBe(0);
      expect(a.paiementId).toBeNull();
      expect(a.Utilisations).toHaveLength(1);
      const u = a.Utilisations[0]!;
      const xor =
        (u.detteInitialeId != null ? 1 : 0) +
        (u.cotisationMensuelleId != null ? 1 : 0);
      expect(xor).toBe(1);
      expect(u.assistanceId).toBeNull();
      expect(u.obligationCotisationId).toBeNull();
    }

    const restantFifo = await appliquerAvoirs(
      demR.adherent!.id,
      new Prisma.Decimal(10),
      "detteInitiale",
      detteR.id,
      prisma
    );
    expect(Number(restantFifo)).toBe(10);

    expect(await prisma.notification.count()).toBe(notifBefore + 1);
    expect(await prisma.noteFraisOutboxEvent.count()).toBe(outboxBefore + 1);
    const outbox = await prisma.noteFraisOutboxEvent.findFirstOrThrow({
      where: { noteFraisId: noteR.id, kind: "REGLEMENT_COMPENSATION" },
    });
    expect(outbox.eventKey).toMatch(
      new RegExp(`^note:${noteR.id}:reglement:.+:compensation$`)
    );
    const payload = outbox.payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "lien",
      "message",
      "titre",
      "userIds",
    ]);
    expect(payload.titre).toBe("Règlement enregistré");
    expect(payload).not.toHaveProperty("montant");
    expect(String(payload.message)).not.toMatch(/VIREMENT|DETTE|COTISATION|motif/i);
    const notif = await prisma.notification.findFirstOrThrow({
      where: {
        userId: demR.id,
        lien: `/user/frais-avances/${noteR.id}`,
        titre: "Règlement enregistré",
      },
    });
    expect(notif.message).toContain("Consultez le détail");
    expect(await prisma.paiementCotisation.count()).toBe(payBefore);
    expect(
      await prisma.depense.count({ where: { noteFraisId: noteR.id } })
    ).toBe(depBefore);

    const choix = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: noteR.id, statut: "ACTIF" },
      include: { Cibles: true },
    });
    expect(Number(choix.montantCompensationUtilise)).toBe(60);
    expect(choix.Cibles.every((c) => Number(c.montantUtilise) === 30)).toBe(
      true
    );

    const lignes = await prisma.noteFraisReglementLigne.findMany({
      where: { Reglement: { noteFraisId: noteR.id } },
    });
    expect(lignes).toHaveLength(2);
    for (const l of lignes) {
      expect(Number(l.montantRestantCibleApres)).toBeLessThan(
        Number(l.montantRestantCibleAvant)
      );
    }

    const regs = await prisma.noteFraisReglement.findMany({
      where: { type: "COMPENSATION", statut: "EXECUTE" },
    });
    const sumComp = regs.reduce((s, r) => s + Number(r.montantTotal), 0);
    const ind = withCompensationsNotesFrais(
      computeChargesFromDepensesValides([
        { montant: 60, origine: "FRAIS_AVANCE" },
      ]),
      sumComp
    );
    expect(ind.compensationsNotesFrais).toBeGreaterThan(0);
    expect(computeSoldeBancaireEstime(100, ind)).toBe(100);
  });

  it("MIXTE : part compensation seulement ; partiel puis complément", async () => {
    await wipe();
    const dem = await createUser("demM", "MEMBRE");
    const tres = await createUser("tresM", "TRESOR");
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2025,
        montant: 200,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "Mixte",
        dateDepense: new Date(),
        montantDemande: 100,
        montantAccepte: 100,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tres.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "m",
        montant: 100,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "MIXTE",
        statut: "ACTIF",
        montantReference: 100,
        montantRemboursement: 40,
        montantCompensation: 60,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: 60,
              montantRestantSnapshot: 200,
              rang: 1,
            },
          ],
        },
      },
    });

    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );
    const p1 = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-mixte-p1",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 25,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(p1.success).toBe(true);
    if (p1.success) expect(p1.data.version).toBe(4);

    const p2 = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 4,
      idempotencyKey: "comp-mixte-p2",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 35,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(p2.success).toBe(true);

    const choix = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(Number(choix.montantCompensationUtilise)).toBe(60);
    expect(Number(choix.montantRembourseUtilise)).toBe(0);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(2);
  });

  it("refus Assistance / bénéficiaire / autre adhérent / refresh / plafond / somme", async () => {
    await wipe();
    const dem = await createUser("demX", "MEMBRE");
    const other = await createUser("other", "MEMBRE");
    const tres = await createUser("tresX", "TRESOR");
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);

    const typeAst = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-comp-ast-${randomUUID().slice(0, 6)}`,
        montant: 50,
        categorie: "Assistance",
        createdBy: tres.id,
      },
    });
    const cmAst = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-03",
        annee: 2026,
        mois: 3,
        typeCotisationId: typeAst.id,
        adherentId: dem.adherent!.id,
        montantAttendu: 50,
        montantPaye: 0,
        montantRestant: 50,
        dateEcheance: new Date(),
        statut: "EnAttente",
        createdBy: tres.id,
      },
    });
    const typeOrd = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-comp-ben-${randomUUID().slice(0, 6)}`,
        montant: 40,
        categorie: "ForfaitMensuel",
        createdBy: tres.id,
      },
    });
    const cmBen = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-04",
        annee: 2026,
        mois: 4,
        typeCotisationId: typeOrd.id,
        adherentId: dem.adherent!.id,
        adherentBeneficiaireId: other.adherent!.id,
        montantAttendu: 40,
        montantPaye: 0,
        montantRestant: 40,
        dateEcheance: new Date(),
        statut: "EnAttente",
        createdBy: tres.id,
      },
    });
    const detteOther = await prisma.detteInitiale.create({
      data: {
        adherentId: other.adherent!.id,
        annee: 2023,
        montant: 50,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2022,
        montant: 50,
        montantPaye: 40,
        createdBy: tres.id,
      },
    });

    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "refus",
        dateDepense: new Date(),
        montantDemande: 50,
        montantAccepte: 50,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tres.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "r",
        montant: 50,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 50,
        montantCompensation: 50,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: 20,
              montantRestantSnapshot: 10,
              rang: 1,
            },
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cmAst.id,
              montantAutorise: 10,
              montantRestantSnapshot: 50,
              rang: 2,
            },
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cmBen.id,
              montantAutorise: 10,
              montantRestantSnapshot: 40,
              rang: 3,
            },
            {
              typeCible: "DETTE_INITIALE",
              cibleId: detteOther.id,
              montantAutorise: 10,
              montantRestantSnapshot: 50,
              rang: 4,
            },
          ],
        },
      },
    });

    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );

    const badAst = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-ast",
      lignes: [
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cmAst.id,
          montant: 10,
          rang: 2,
        },
      ],
      client: prisma,
    });
    expect(badAst.success).toBe(false);

    const badBen = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-ben",
      lignes: [
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cmBen.id,
          montant: 10,
          rang: 3,
        },
      ],
      client: prisma,
    });
    expect(badBen.success).toBe(false);

    const badOther = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-other",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: detteOther.id,
          montant: 10,
          rang: 4,
        },
      ],
      client: prisma,
    });
    expect(badOther.success).toBe(false);

    const refresh = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-refresh",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 15,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(refresh.success).toBe(false);
    if (!refresh.success) expect(refresh.code).toBe("REFRESH_REQUIRED");

    const plafond = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-plafond",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 10,
          rang: 1,
        },
      ],
      client: prisma,
    });
    // autorise 20, restant live 10 → OK pour 10
    expect(plafond.success).toBe(true);

    // version now 4 ; plafond autorisé restant = 10
    const overAuth = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 4,
      idempotencyKey: "comp-over-auth",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 11,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(overAuth.success).toBe(false);

    const stale = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-stale",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 5,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(stale.success).toBe(false);
    if (!stale.success) expect(stale.code).toBe("VERSION_CONFLICT");
  });

  it("idempotence + concurrence deux trésoriers", async () => {
    await wipe();
    const dem = await createUser("demC", "MEMBRE");
    const t1 = await createUser("t1c", "TRESOR");
    const t2 = await createUser("t2c", "ADMIN");
    await ensureTypeDepenseFraisAvanceForTests(prisma, t1.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2021,
        montant: 80,
        montantPaye: 0,
        createdBy: t1.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "conc",
        dateDepense: new Date(),
        montantDemande: 40,
        montantAccepte: 40,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: t1.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "c",
        montant: 40,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: t1.id,
        validatedBy: t1.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 40,
        montantCompensation: 40,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: 40,
              montantRestantSnapshot: 80,
              rang: 1,
            },
          ],
        },
      },
    });

    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );

    const first = await executeNoteFraisCompensation({
      actorUserId: t1.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-idem-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 20,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(first.success).toBe(true);

    const replay = await executeNoteFraisCompensation({
      actorUserId: t1.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-idem-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 20,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(replay.success).toBe(true);
    if (replay.success) expect(replay.data.alreadyExecuted).toBe(true);

    const conflict = await executeNoteFraisCompensation({
      actorUserId: t1.id,
      noteId: note.id,
      expectedNoteVersion: 4,
      idempotencyKey: "comp-idem-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 15,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(conflict.success).toBe(false);
    if (!conflict.success) expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");

    // Reset for concurrency on remaining plafond
    const note2 = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "race",
        dateDepense: new Date(),
        montantDemande: 30,
        montantAccepte: 30,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: t1.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "r",
        montant: 30,
        dateDepense: note2.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note2.id,
        createdBy: t1.id,
        validatedBy: t1.id,
      },
    });
    const dette2 = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2020,
        montant: 30,
        montantPaye: 0,
        createdBy: t1.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note2.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 30,
        montantCompensation: 30,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette2.id,
              montantAutorise: 30,
              montantRestantSnapshot: 30,
              rang: 1,
            },
          ],
        },
      },
    });

    const [r1, r2] = await Promise.all([
      executeNoteFraisCompensation({
        actorUserId: t1.id,
        noteId: note2.id,
        expectedNoteVersion: 3,
        idempotencyKey: "comp-race-a",
        lignes: [
          {
            typeCible: "DETTE_INITIALE",
            cibleId: dette2.id,
            montant: 30,
            rang: 1,
          },
        ],
        client: prisma,
      }),
      executeNoteFraisCompensation({
        actorUserId: t2.id,
        noteId: note2.id,
        expectedNoteVersion: 3,
        idempotencyKey: "comp-race-b",
        lignes: [
          {
            typeCible: "DETTE_INITIALE",
            cibleId: dette2.id,
            montant: 30,
            rang: 1,
          },
        ],
        client: prisma,
      }),
    ]);
    const ok = [r1, r2].filter((r) => r.success);
    const ko = [r1, r2].filter((r) => !r.success);
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note2.id } })
    ).toBe(1);

    // Replay authz : MEMBRE (≠ demandeur) avec la clé du gagnant → FORBIDDEN
    const membreOther = await createUser("memRace", "MEMBRE");
    const winnerKey = r1.success ? "comp-race-a" : "comp-race-b";
    const membreReplay = await executeNoteFraisCompensation({
      actorUserId: membreOther.id,
      noteId: note2.id,
      expectedNoteVersion: 3,
      idempotencyKey: winnerKey,
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette2.id,
          montant: 30,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(membreReplay.success).toBe(false);
    if (!membreReplay.success) expect(membreReplay.code).toBe("FORBIDDEN");
  });

  it("rollback TX : 1ʳᵉ cible appliquée puis échec 2ᵉ → zéro effet", async () => {
    await wipe();
    const dem = await createUser("demRb", "MEMBRE");
    const tres = await createUser("tresRb", "TRESOR");
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);

    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2019,
        montant: 100,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const typeCm = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-comp-rb-${randomUUID().slice(0, 6)}`,
        montant: 50,
        categorie: "ForfaitMensuel",
        createdBy: tres.id,
      },
    });
    const cm = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-06",
        annee: 2026,
        mois: 6,
        typeCotisationId: typeCm.id,
        adherentId: dem.adherent!.id,
        montantAttendu: 50,
        montantPaye: 0,
        montantRestant: 50,
        dateEcheance: new Date("2026-06-30"),
        statut: "EnAttente",
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "rollback-2cibles",
        dateDepense: new Date(),
        montantDemande: 40,
        montantAccepte: 40,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tres.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "rb",
        montant: 40,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 40,
        montantCompensation: 40,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: 20,
              montantRestantSnapshot: 100,
              rang: 1,
            },
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cm.id,
              montantAutorise: 20,
              montantRestantSnapshot: 50,
              rang: 2,
            },
          ],
        },
      },
    });

    const payeAvant = Number(
      (await prisma.detteInitiale.findUniqueOrThrow({ where: { id: dette.id } }))
        .montantPaye
    );
    const cmPayeAvant = Number(
      (await prisma.cotisationMensuelle.findUniqueOrThrow({ where: { id: cm.id } }))
        .montantPaye
    );
    const versionAvant = (
      await prisma.noteFrais.findUniqueOrThrow({ where: { id: note.id } })
    ).version;

    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );

    let firstApplied = false;
    const res = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-rollback-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 20,
          rang: 1,
        },
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cm.id,
          montant: 20,
          rang: 2,
        },
      ],
      client: prisma,
      beforeApplyLigne: async (index) => {
        if (index === 0) {
          firstApplied = true;
          return;
        }
        // Échec déterministe après que la 1ʳᵉ ligne a commencé (hook avant 2ᵉ)
        expect(firstApplied).toBe(true);
        throw new Error("INJECTED_SECOND_CIBLE_FAILURE");
      },
    });
    expect(res.success).toBe(false);

    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    const cmAfter = await prisma.cotisationMensuelle.findUniqueOrThrow({
      where: { id: cm.id },
    });
    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(Number(detteAfter.montantPaye)).toBe(payeAvant);
    expect(Number(cmAfter.montantPaye)).toBe(cmPayeAvant);
    expect(noteAfter.version).toBe(versionAvant);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(0);
    expect(
      await prisma.avoir.count({
        where: {
          adherentId: dem.adherent!.id,
          origine: "COMPENSATION_NOTE_FRAIS",
        },
      })
    ).toBe(0);
    const choix = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
      include: { Cibles: true },
    });
    expect(Number(choix.montantCompensationUtilise)).toBe(0);
    expect(choix.Cibles.every((c) => Number(c.montantUtilise) === 0)).toBe(
      true
    );
  });

  it("rollback afterNotifyOutbox : zéro finance, notification et outbox", async () => {
    await wipe();
    const dem = await createUser("demNf", "MEMBRE");
    const tres = await createUser("tresNf", "TRESOR");
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2018,
        montant: 50,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "comp-after-notify",
        dateDepense: new Date(),
        montantDemande: 25,
        montantAccepte: 25,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tres.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "cnf",
        montant: 25,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 25,
        montantCompensation: 25,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: 25,
              montantRestantSnapshot: 50,
              rang: 1,
            },
          ],
        },
      },
    });

    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );
    const fail = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "comp-pg-after-notify",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: 25,
          rang: 1,
        },
      ],
      client: prisma,
      afterNotifyOutbox: async () => {
        throw new Error("forced-comp-notify-rollback");
      },
    });
    expect(fail.success).toBe(false);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(0);
    expect(
      await prisma.avoir.count({
        where: {
          adherentId: dem.adherent!.id,
          origine: "COMPENSATION_NOTE_FRAIS",
        },
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
    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    expect(Number(detteAfter.montantPaye)).toBe(0);
  }, 60_000);

  it("concurrence même clé : exactement une notification et une outbox", async () => {
    await wipe();
    const dem = await createUser("demSame", "MEMBRE");
    const t1 = await createUser("t1same", "TRESOR");
    const t2 = await createUser("t2same", "ADMIN");
    await ensureTypeDepenseFraisAvanceForTests(prisma, t1.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2017,
        montant: 40,
        montantPaye: 0,
        createdBy: t1.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "comp-same-key",
        dateDepense: new Date(),
        montantDemande: 40,
        montantAccepte: 40,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: t1.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "csk",
        montant: 40,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: t1.id,
        validatedBy: t1.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 40,
        montantCompensation: 40,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: 40,
              montantRestantSnapshot: 40,
              rang: 1,
            },
          ],
        },
      },
    });

    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );
    const key = "comp-pg-same-key-01";
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

    const payload = {
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: key,
      lignes: [
        {
          typeCible: "DETTE_INITIALE" as const,
          cibleId: dette.id,
          montant: 40,
          rang: 1,
        },
      ],
      client: prisma,
    };

    const p1 = executeNoteFraisCompensation({
      ...payload,
      actorUserId: t1.id,
      beforeDemandeurLock: async () => {
        signal1();
        await go;
      },
    });
    const p2 = executeNoteFraisCompensation({
      ...payload,
      actorUserId: t2.id,
      beforeDemandeurLock: async () => {
        signal2();
        await go;
      },
    });
    await bothAtLock;
    releaseBoth();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.success && r2.success).toBe(true);
    const fresh = [r1, r2].filter(
      (r) => r.success && !r.data.alreadyExecuted
    );
    const already = [r1, r2].filter(
      (r) => r.success && r.data.alreadyExecuted
    );
    expect(fresh.length + already.length).toBe(2);
    expect(fresh.length).toBe(1);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "REGLEMENT_COMPENSATION" },
      })
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: {
          userId: dem.id,
          lien: `/user/frais-avances/${note.id}`,
          titre: "Règlement enregistré",
        },
      })
    ).toBe(1);
  }, 90_000);
});
