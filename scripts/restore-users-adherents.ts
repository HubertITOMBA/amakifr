/**
 * Restaure users, adherents, adresses, telephones, types_cotisation_mensuelle,
 * assistances, dettes_initiales, cotisations_du_mois, cotisations_mensuelles depuis le fichier JSON
 * créé par backup-users-adherents.ts. À exécuter APRÈS "npx prisma migrate reset" (base vide).
 *
 * Ordre de restauration : users → adherents → adresses → telephones → typesCotisationMensuelle
 * → cotisationsDuMois → cotisationsMensuelles → dettesInitiales → assistances
 *
 * Usage: npm run db:restore-users-adherents
 * Fichier lu: scripts/backup-users-adherents.json
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function parseDate(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === "string") return new Date(v);
  if (v instanceof Date) return v;
  return null;
}

function parseDecimal(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return "0";
}

function parseJson(v: unknown): object | null {
  if (v == null) return null;
  if (typeof v === "object") return v as object;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as object;
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const backupPath = path.join(process.cwd(), "scripts", "backup-users-adherents.json");

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Fichier introuvable: ${backupPath}`);
    console.error("   Exécutez d'abord: npx tsx scripts/backup-users-adherents.ts");
    process.exit(1);
  }

  const raw = fs.readFileSync(backupPath, "utf-8");
  const backup: {
    exportedAt?: string;
    users?: Array<Record<string, unknown>>;
    adherents?: Array<Record<string, unknown>>;
    adresses?: Array<Record<string, unknown>>;
    telephones?: Array<Record<string, unknown>>;
    typesCotisationMensuelle?: Array<Record<string, unknown>>;
    assistances?: Array<Record<string, unknown>>;
    dettesInitiales?: Array<Record<string, unknown>>;
    cotisationsDuMois?: Array<Record<string, unknown>>;
    cotisationsMensuelles?: Array<Record<string, unknown>>;
  } = JSON.parse(raw);

  const users = backup.users ?? [];
  const adherents = backup.adherents ?? [];
  const adresses = backup.adresses ?? [];
  const telephones = backup.telephones ?? [];
  const typesCotisationMensuelle = backup.typesCotisationMensuelle ?? [];
  const assistances = backup.assistances ?? [];
  const dettesInitiales = backup.dettesInitiales ?? [];
  const cotisationsDuMois = backup.cotisationsDuMois ?? [];
  const cotisationsMensuelles = backup.cotisationsMensuelles ?? [];

  const hasData =
    users.length > 0 ||
    adherents.length > 0 ||
    adresses.length > 0 ||
    telephones.length > 0 ||
    typesCotisationMensuelle.length > 0 ||
    assistances.length > 0 ||
    dettesInitiales.length > 0 ||
    cotisationsDuMois.length > 0 ||
    cotisationsMensuelles.length > 0;

  if (!hasData) {
    console.log("⚠️  Aucune donnée à restaurer dans le fichier.");
    return;
  }

  console.log("📥 Restauration users, adherents, adresses, telephones, types cotisation, assistances, dettes, cotisations...\n");

  let userCount = 0;
  let adherentCount = 0;

  if (users.length > 0) {
    const userData = users.map((u) => ({
      id: u.id as string,
      name: (u.name as string) ?? null,
      email: (u.email as string) ?? null,
      emailVerified: parseDate(u.emailVerified),
      password: (u.password as string) ?? null,
      image: (u.image as string) ?? null,
      role: (u.role as string) ?? "MEMBRE",
      status: (u.status as string) ?? "Inactif",
      lastLogin: parseDate(u.lastLogin),
      createdAt: parseDate(u.createdAt) ?? new Date(),
      updatedAt: parseDate(u.updatedAt) ?? new Date(),
      remember_token: (u.remember_token as string) ?? null,
      isTwoFactorEnabled: (u.isTwoFactorEnabled as boolean) ?? false,
    }));

    await prisma.user.createMany({
      data: userData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Users: ${userData.length}`);
  }

  if (adherents.length > 0) {
    // Après reset, postes_templates peut être vide : on met posteTemplateId à null
    // pour éviter une erreur de clé étrangère (à réassigner ensuite si besoin).
    const adherentData = adherents.map((a) => ({
      id: a.id as string,
      civility: (a.civility as string) ?? null,
      firstname: a.firstname as string,
      lastname: a.lastname as string,
      dateNaissance: parseDate(a.dateNaissance),
      typeAdhesion: (a.typeAdhesion as string) ?? null,
      profession: (a.profession as string) ?? null,
      anneePromotion: (a.anneePromotion as string) ?? null,
      centresInteret: (a.centresInteret as string) ?? null,
      autorisationImage: (a.autorisationImage as boolean) ?? false,
      accepteCommunications: (a.accepteCommunications as boolean) ?? true,
      nombreEnfants: (a.nombreEnfants as number) ?? 0,
      evenementsFamiliaux: (a.evenementsFamiliaux as string) ?? null,
      datePremiereAdhesion: parseDate(a.datePremiereAdhesion),
      fraisAdhesionPaye: (a.fraisAdhesionPaye as boolean) ?? false,
      datePaiementFraisAdhesion: parseDate(a.datePaiementFraisAdhesion),
      estAncienAdherent: (a.estAncienAdherent as boolean) ?? false,
      numeroPasseport: (a.numeroPasseport as string) ?? null,
      dateGenerationPasseport: parseDate(a.dateGenerationPasseport),
      posteTemplateId: null as string | null, // réassigner après si besoin
      created_at: parseDate(a.created_at),
      updated_at: parseDate(a.updated_at),
      userId: a.userId as string,
    }));

    await prisma.adherent.createMany({
      data: adherentData,
      skipDuplicates: true,
    });
    adherentCount = adherentData.length;
    console.log(`   ✅ Adherents: ${adherentCount}`);
  }

  if (adresses.length > 0) {
    const adresseData = adresses.map((a) => ({
      id: a.id as string,
      adherentId: a.adherentId as string,
      streetnum: (a.streetnum as string) ?? null,
      street1: (a.street1 as string) ?? null,
      street2: (a.street2 as string) ?? null,
      codepost: (a.codepost as string) ?? null,
      city: (a.city as string) ?? null,
      country: (a.country as string) ?? null,
      banId: (a.banId as string) ?? null,
      label: (a.label as string) ?? null,
      housenumber: (a.housenumber as string) ?? null,
      street: (a.street as string) ?? null,
      postcode: (a.postcode as string) ?? null,
      citycode: (a.citycode as string) ?? null,
      department: (a.department as string) ?? null,
      region: (a.region as string) ?? null,
      latitude: (a.latitude as number) ?? null,
      longitude: (a.longitude as number) ?? null,
      score: (a.score as number) ?? null,
      type: (a.type as string) ?? null,
      metadata: parseJson(a.metadata),
      createdAt: parseDate(a.createdAt) ?? new Date(),
      updatedAt: parseDate(a.updatedAt) ?? new Date(),
    }));
    await prisma.adresse.createMany({
      data: adresseData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Adresses: ${adresseData.length}`);
  }

  if (telephones.length > 0) {
    const telephoneData = telephones.map((t) => ({
      id: t.id as string,
      adherentId: t.adherentId as string,
      numero: t.numero as string,
      type: t.type as string,
      estPrincipal: (t.estPrincipal as boolean) ?? false,
      description: (t.description as string) ?? null,
      createdAt: parseDate(t.createdAt) ?? new Date(),
      updatedAt: parseDate(t.updatedAt) ?? new Date(),
    }));
    await prisma.telephone.createMany({
      data: telephoneData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Telephones: ${telephoneData.length}`);
  }

  if (typesCotisationMensuelle.length > 0) {
    const typeData = typesCotisationMensuelle.map((t) => ({
      id: t.id as string,
      nom: t.nom as string,
      description: (t.description as string) ?? null,
      montant: parseDecimal(t.montant),
      obligatoire: (t.obligatoire as boolean) ?? true,
      actif: (t.actif as boolean) ?? true,
      ordre: (t.ordre as number) ?? 0,
      categorie: (t.categorie as string) ?? "Divers",
      aBeneficiaire: (t.aBeneficiaire as boolean) ?? false,
      createdBy: t.createdBy as string,
      createdAt: parseDate(t.createdAt) ?? new Date(),
      updatedAt: parseDate(t.updatedAt) ?? new Date(),
    }));
    await prisma.typeCotisationMensuelle.createMany({
      data: typeData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Types cotisation mensuelle: ${typeData.length}`);
  }

  if (cotisationsDuMois.length > 0) {
    const cdmData = cotisationsDuMois.map((c) => ({
      id: c.id as string,
      periode: c.periode as string,
      annee: (c.annee as number) ?? new Date().getFullYear(),
      mois: (c.mois as number) ?? 1,
      typeCotisationId: c.typeCotisationId as string,
      montantBase: parseDecimal(c.montantBase),
      dateEcheance: parseDate(c.dateEcheance) ?? new Date(),
      description: (c.description as string) ?? null,
      statut: (c.statut as string) ?? "Planifie",
      adherentBeneficiaireId: (c.adherentBeneficiaireId as string) ?? null,
      createdBy: c.createdBy as string,
      createdAt: parseDate(c.createdAt) ?? new Date(),
      updatedAt: parseDate(c.updatedAt) ?? new Date(),
    }));
    await prisma.cotisationDuMois.createMany({
      data: cdmData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Cotisations du mois: ${cdmData.length}`);
  }

  if (cotisationsMensuelles.length > 0) {
    const cmData = cotisationsMensuelles.map((c) => ({
      id: c.id as string,
      periode: c.periode as string,
      annee: (c.annee as number) ?? new Date().getFullYear(),
      mois: (c.mois as number) ?? 1,
      typeCotisationId: c.typeCotisationId as string,
      adherentId: c.adherentId as string,
      adherentBeneficiaireId: (c.adherentBeneficiaireId as string) ?? null,
      montantAttendu: parseDecimal(c.montantAttendu),
      montantPaye: parseDecimal(c.montantPaye),
      montantRestant: parseDecimal(c.montantRestant),
      dateEcheance: parseDate(c.dateEcheance) ?? new Date(),
      statut: (c.statut as string) ?? "EnAttente",
      description: (c.description as string) ?? null,
      cotisationDuMoisId: (c.cotisationDuMoisId as string) ?? null,
      createdBy: c.createdBy as string,
      createdAt: parseDate(c.createdAt) ?? new Date(),
      updatedAt: parseDate(c.updatedAt) ?? new Date(),
    }));
    await prisma.cotisationMensuelle.createMany({
      data: cmData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Cotisations mensuelles: ${cmData.length}`);
  }

  if (dettesInitiales.length > 0) {
    const detteData = dettesInitiales.map((d) => ({
      id: d.id as string,
      adherentId: d.adherentId as string,
      annee: (d.annee as number) ?? new Date().getFullYear(),
      montant: parseDecimal(d.montant),
      montantPaye: parseDecimal(d.montantPaye),
      montantRestant: parseDecimal(d.montantRestant),
      description: (d.description as string) ?? null,
      createdAt: parseDate(d.createdAt) ?? new Date(),
      updatedAt: parseDate(d.updatedAt) ?? new Date(),
      createdBy: d.createdBy as string,
    }));
    await prisma.detteInitiale.createMany({
      data: detteData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Dettes initiales: ${detteData.length}`);
  }

  if (assistances.length > 0) {
    const assistanceData = assistances.map((a) => ({
      id: a.id as string,
      adherentId: a.adherentId as string,
      type: a.type as string,
      typeCotisationId: (a.typeCotisationId as string) ?? null,
      montant: parseDecimal(a.montant),
      dateEvenement: parseDate(a.dateEvenement) ?? new Date(),
      montantPaye: parseDecimal(a.montantPaye),
      montantRestant: parseDecimal(a.montantRestant),
      statut: (a.statut as string) ?? "EnAttente",
      description: (a.description as string) ?? null,
      createdAt: parseDate(a.createdAt) ?? new Date(),
      updatedAt: parseDate(a.updatedAt) ?? new Date(),
      createdBy: a.createdBy as string,
    }));
    await prisma.assistance.createMany({
      data: assistanceData,
      skipDuplicates: true,
    });
    console.log(`   ✅ Assistances: ${assistanceData.length}`);
  }

  console.log(`\n✅ Restauration terminée (export du ${backup.exportedAt ?? "?"}).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
