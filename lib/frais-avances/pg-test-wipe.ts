/**
 * Nettoyage déterministe des fixtures PG notes de frais (allowlist uniquement).
 * Ordre FK-safe incluant tables 4.8–4.9.
 */
import type { PrismaClient } from "@prisma/client";

export const NOTES_FRAIS_PG_FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

/**
 * Purge complète des objets notes-frais / journal / archive / reports
 * et des fixtures user liées au suffixe email de test.
 *
 * @param client - Prisma branché sur la base allowlistée
 * @param emailSuffix - Suffixe email des fixtures (défaut partagé)
 */
export async function wipeNotesFraisPgFixtures(
  client: PrismaClient,
  emailSuffix: string = NOTES_FRAIS_PG_FIXTURE_EMAIL_SUFFIX
): Promise<void> {
  // 4.8 annulation
  await client.noteFraisAnnulationInverseCible.deleteMany({});
  await client.noteFraisReglementAnnulationDemande.deleteMany({});
  // 4.6 / 4.7
  await client.noteFraisCorrectionInverseCible.deleteMany({});
  await client.noteFraisReglementCorrection.deleteMany({});
  await client.noteFraisRestitution.deleteMany({});
  // Avoir / UA (y compris détachés 4.9)
  await client.utilisationAvoir.deleteMany({});
  await client.avoir.deleteMany({
    where: {
      OR: [
        { origine: "COMPENSATION_NOTE_FRAIS" },
        { noteFraisReglementLigneId: { not: null } },
        { adherentId: null },
        {
          Adherent: {
            User: { email: { endsWith: emailSuffix } },
          },
        },
      ],
    },
  });
  await client.noteFraisReglementLigne.deleteMany({});
  await client.noteFraisReglement.deleteMany({});
  await client.noteFraisReglementOperation.deleteMany({});
  await client.noteFraisChoixReglementCible.deleteMany({});
  await client.noteFraisChoixReglement.deleteMany({});
  // Charges FRAIS_AVANCE (liées ou détachées)
  await client.depense.deleteMany({
    where: {
      OR: [{ noteFraisId: { not: null } }, { origine: "FRAIS_AVANCE" }],
    },
  });
  await client.noteFraisFileJob.deleteMany({});
  // 4.10 legal holds avant archives (FK Restrict)
  if ("noteFraisLegalHold" in client) {
    await (client as PrismaClient).noteFraisLegalHold.deleteMany({});
  }
  await client.noteFraisArchiveAccessLog.deleteMany({});
  await client.justificatifNoteFraisArchive.deleteMany({});
  await client.noteFraisArchive.deleteMany({});
  // 4.9 journal / reports
  await client.noteFraisJournalFinancierEvenement.deleteMany({});
  await client.noteFraisReportFinancierPeriode.deleteMany({});
  // 4.10 — reset politiques à la seed ACTIVE (pas d'accumulation de brouillons)
  if ("noteFraisRetentionPolicyVersion" in client) {
    const c = client as PrismaClient;
    await c.noteFraisRetentionPolicyVersion.deleteMany({});
    await c.noteFraisRetentionPolicyVersion.create({
      data: {
        id: "nf_ret_pol_v1_seed_4x10",
        version: 1,
        statut: "ACTIVE",
        p1Years: 10,
        p2Years: 10,
        p3Years: 10,
        exerciceClotureMois: 12,
        exerciceClotureJour: 31,
        reportsSansEcheance: true,
        motif:
          "Migration 4.10 — politique initiale métier validée (seed test wipe).",
        createdByUserId: null,
        activatedByUserId: null,
        activatedAt: new Date(),
        effectiveAt: new Date("2026-09-18T00:00:00.000Z"),
        activationIdempotencyKey: "seed-4x10-retention-v1",
        occVersion: 1,
      },
    });
  }
  await client.noteFraisDecision.deleteMany({});
  await client.noteFraisOutboxEvent.deleteMany({});
  await client.justificatifNoteFrais.deleteMany({});
  await client.noteFrais.deleteMany({});
  await client.notification.deleteMany({
    where: {
      OR: [
        { lien: { contains: "/admin/frais-avances/" } },
        { lien: { contains: "/user/frais-avances/" } },
      ],
    },
  });
  await client.cotisationMensuelle.deleteMany({
    where: {
      Adherent: { User: { email: { endsWith: emailSuffix } } },
    },
  });
  await client.detteInitiale.deleteMany({
    where: {
      Adherent: { User: { email: { endsWith: emailSuffix } } },
    },
  });
  await client.typeCotisationMensuelle.deleteMany({
    where: {
      CreatedBy: { email: { endsWith: emailSuffix } },
    },
  });
  await client.userAdminRole.deleteMany({
    where: { user: { email: { endsWith: emailSuffix } } },
  });
  await client.user.deleteMany({
    where: { email: { endsWith: emailSuffix } },
  });
}
