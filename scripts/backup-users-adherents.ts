/**
 * Sauvegarde users, adherents, adresses, telephones, types_cotisation_mensuelle,
 * assistances, dettes_initiales, cotisations_du_mois, cotisations_mensuelles dans un fichier JSON.
 *
 * Procédure complète (dev avant migrate reset) :
 *   1. npm run db:backup-users-adherents
 *   2. npx prisma migrate reset   (confirmer : toutes les données seront perdues)
 *   3. npm run db:restore-users-adherents
 *
 * Usage: npm run db:backup-users-adherents
 * Fichier généré: scripts/backup-users-adherents.json (ignoré par git)
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      "toString" in v &&
      typeof (v as { toString: () => string }).toString === "function"
    ) {
      // Prisma Decimal et autres objets avec toString
      out[k] = (v as { toString: () => string }).toString();
    } else if (v !== null) {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  console.log("📦 Sauvegarde des users, adherents, adresses, telephones et dettes_initiales...\n");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      password: true,
      image: true,
      role: true,
      status: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      remember_token: true,
      isTwoFactorEnabled: true,
    },
  });

  const adherents = await prisma.adherent.findMany({
    select: {
      id: true,
      civility: true,
      firstname: true,
      lastname: true,
      dateNaissance: true,
      typeAdhesion: true,
      profession: true,
      anneePromotion: true,
      centresInteret: true,
      autorisationImage: true,
      accepteCommunications: true,
      nombreEnfants: true,
      evenementsFamiliaux: true,
      datePremiereAdhesion: true,
      fraisAdhesionPaye: true,
      datePaiementFraisAdhesion: true,
      estAncienAdherent: true,
      numeroPasseport: true,
      dateGenerationPasseport: true,
      posteTemplateId: true,
      created_at: true,
      updated_at: true,
      userId: true,
    },
  });

  const adresses = await prisma.adresse.findMany({
    select: {
      id: true,
      adherentId: true,
      streetnum: true,
      street1: true,
      street2: true,
      codepost: true,
      city: true,
      country: true,
      banId: true,
      label: true,
      housenumber: true,
      street: true,
      postcode: true,
      citycode: true,
      department: true,
      region: true,
      latitude: true,
      longitude: true,
      score: true,
      type: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const telephones = await prisma.telephone.findMany({
    select: {
      id: true,
      adherentId: true,
      numero: true,
      type: true,
      estPrincipal: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const typesCotisationMensuelle = await prisma.typeCotisationMensuelle.findMany({
    select: {
      id: true,
      nom: true,
      description: true,
      montant: true,
      obligatoire: true,
      actif: true,
      ordre: true,
      categorie: true,
      aBeneficiaire: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // typeCotisationId peut être absent si la migration 20260226120000 n'est pas encore appliquée
  let assistances: Array<Record<string, unknown>> = [];
  try {
    const rows = await prisma.assistance.findMany({
      select: {
        id: true,
        adherentId: true,
        type: true,
        typeCotisationId: true,
        montant: true,
        dateEvenement: true,
        montantPaye: true,
        montantRestant: true,
        statut: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    });
    assistances = rows.map((r) => serializeRow(r as unknown as Record<string, unknown>));
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2022" || (err as Error)?.message?.includes("does not exist")) {
      const rows = await prisma.assistance.findMany({
        select: {
          id: true,
          adherentId: true,
          type: true,
          montant: true,
          dateEvenement: true,
          montantPaye: true,
          montantRestant: true,
          statut: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
        },
      });
      assistances = rows.map((r) => ({ ...serializeRow(r as unknown as Record<string, unknown>), typeCotisationId: null }));
    } else {
      throw err;
    }
  }

  const dettesInitiales = await prisma.detteInitiale.findMany({
    select: {
      id: true,
      adherentId: true,
      annee: true,
      montant: true,
      montantPaye: true,
      montantRestant: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      createdBy: true,
    },
  });

  const cotisationsDuMois = await prisma.cotisationDuMois.findMany({
    select: {
      id: true,
      periode: true,
      annee: true,
      mois: true,
      typeCotisationId: true,
      montantBase: true,
      dateEcheance: true,
      description: true,
      statut: true,
      adherentBeneficiaireId: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
    select: {
      id: true,
      periode: true,
      annee: true,
      mois: true,
      typeCotisationId: true,
      adherentId: true,
      adherentBeneficiaireId: true,
      montantAttendu: true,
      montantPaye: true,
      montantRestant: true,
      dateEcheance: true,
      statut: true,
      description: true,
      cotisationDuMoisId: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const backup = {
    exportedAt: new Date().toISOString(),
    users: users.map((u) => serializeRow(u as unknown as Record<string, unknown>)),
    adherents: adherents.map((a) => serializeRow(a as unknown as Record<string, unknown>)),
    adresses: adresses.map((a) => serializeRow(a as unknown as Record<string, unknown>)),
    telephones: telephones.map((t) => serializeRow(t as unknown as Record<string, unknown>)),
    typesCotisationMensuelle: typesCotisationMensuelle.map((t) => serializeRow(t as unknown as Record<string, unknown>)),
    assistances: assistances.map((a) => serializeRow(a as unknown as Record<string, unknown>)),
    dettesInitiales: dettesInitiales.map((d) => serializeRow(d as unknown as Record<string, unknown>)),
    cotisationsDuMois: cotisationsDuMois.map((c) => serializeRow(c as unknown as Record<string, unknown>)),
    cotisationsMensuelles: cotisationsMensuelles.map((c) => serializeRow(c as unknown as Record<string, unknown>)),
  };

  const outPath = path.join(process.cwd(), "scripts", "backup-users-adherents.json");
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf-8");

  console.log(`   Users: ${users.length}`);
  console.log(`   Adherents: ${adherents.length}`);
  console.log(`   Adresses: ${adresses.length}`);
  console.log(`   Telephones: ${telephones.length}`);
  console.log(`   Types cotisation mensuelle: ${typesCotisationMensuelle.length}`);
  console.log(`   Assistances: ${assistances.length}`);
  console.log(`   Dettes initiales: ${dettesInitiales.length}`);
  console.log(`   Cotisations du mois: ${cotisationsDuMois.length}`);
  console.log(`   Cotisations mensuelles: ${cotisationsMensuelles.length}`);
  console.log(`\n✅ Sauvegarde écrite: ${outPath}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
