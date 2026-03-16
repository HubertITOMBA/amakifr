/**
 * Purge : cotisations du mois + cotisations mensuelles + paiements + avoirs + assistances.
 * Conservé : dettes initiales uniquement (pour tester paiement avec avoir et dettes initiales).
 *
 * Périmètre au choix :
 *   --scope=all              : tous les adhérents (comportement historique)
 *   --scope=one --adherent-id=ID   : un seul adhérent
 *   --scope=group --adherent-ids=ID1,ID2,... : un groupe d'adhérents
 *
 * Ordre des suppressions (contraintes FK) :
 *   1. UtilisationAvoir
 *   2. Relances cotisations mensuelles
 *   3. PaiementCotisation
 *   4. Assistance
 *   5. CotisationMensuelle
 *   6. [Si scope=all uniquement] CotisationDuMois
 *   7. Avoir
 *   8. [Si scope=all uniquement] Réinitialiser montantPaye des dettes_initiales à 0
 *
 * Exécution :
 *   npm run db:purge-cotisations-mois-et-paiements                    # tous les adhérents (défaut)
 *   npm run db:purge-cotisations-mois-et-paiements -- --scope=all     # idem
 *   npm run db:purge-cotisations-mois-et-paiements -- --scope=one --adherent-id=clxxx...
 *   npm run db:purge-cotisations-mois-et-paiements -- --scope=group --adherent-ids=id1,id2,id3
 *   npm run db:purge-cotisations-mois-et-paiements -- --list-adherents # afficher les IDs pour --scope=one/group
 */

import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

type Scope = "all" | "one" | "group";

function showHelp() {
  console.log(`
Usage:
  npm run db:purge-cotisations-mois-et-paiements [options]

Options:
  --scope=all                          Tous les adhérents (défaut si aucune option)
  --scope=one --adherent-id=ID          Un seul adhérent (ID = id Prisma de l'adhérent)
  --scope=group --adherent-ids=ID1,ID2  Un groupe d'adhérents (IDs séparés par des virgules)
  --list-adherents, -l                  Afficher la liste des adhérents avec leurs IDs (pour copier --adherent-id)

Exemples:
  npm run db:purge-cotisations-mois-et-paiements
  npm run db:purge-cotisations-mois-et-paiements -- --scope=all
  npm run db:purge-cotisations-mois-et-paiements -- --scope=one --adherent-id=clxxx...
  npm run db:purge-cotisations-mois-et-paiements -- --scope=group --adherent-ids=id1,id2,id3

Supprimé : cotisations du mois (si scope=all), cotisations mensuelles, paiements, avoirs,
utilisations d'avoir, relances, assistances. Conservé : dettes initiales.
`);
}

function parseArgs(): { scope: Scope; adherentIds: string[]; help: boolean; listAdherents: boolean } {
  const args = process.argv.slice(2);
  let scope: Scope = "all";
  let adherentIds: string[] = [];
  let help = false;
  let listAdherents = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") {
      help = true;
      break;
    }
    if (args[i] === "--list-adherents" || args[i] === "-l") {
      listAdherents = true;
    } else if (args[i].startsWith("--scope=")) {
      const v = args[i].split("=")[1]?.toLowerCase();
      if (v === "all" || v === "one" || v === "group") scope = v;
    } else if (args[i].startsWith("--adherent-id=")) {
      const id = args[i].split("=")[1]?.trim();
      if (id) adherentIds = [id];
    } else if (args[i].startsWith("--adherent-ids=")) {
      const raw = args[i].split("=")[1]?.trim() ?? "";
      adherentIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  if (help) return { scope: "all", adherentIds: [], help: true, listAdherents: false };

  if ((scope === "one" || scope === "group") && adherentIds.length === 0) {
    console.error("❌ Pour --scope=one ou --scope=group, indiquez --adherent-id=ID ou --adherent-ids=ID1,ID2,...");
    process.exit(1);
  }
  if (scope === "one" && adherentIds.length > 1) {
    console.error("❌ Pour --scope=one, utilisez un seul --adherent-id=ID");
    process.exit(1);
  }

  return { scope, adherentIds, help: false, listAdherents };
}

async function listAdherents() {
  const adherents = await prisma.adherent.findMany({
    orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
    select: { id: true, firstname: true, lastname: true },
  });
  console.log("Liste des adhérents (id pour --adherent-id ou --adherent-ids) :\n");
  for (const a of adherents) {
    console.log(`  ${a.id}  ${a.firstname} ${a.lastname}`);
  }
  console.log(`\nTotal : ${adherents.length} adhérent(s).`);
}

async function purge() {
  const { scope, adherentIds, help, listAdherents } = parseArgs();
  if (help) {
    showHelp();
    return;
  }
  if (listAdherents) {
    await listAdherents();
    return;
  }

  const label =
    scope === "all"
      ? "tous les adhérents"
      : scope === "one"
        ? `un adhérent (${adherentIds[0]})`
        : `un groupe de ${adherentIds.length} adhérent(s)`;

  console.log("🗑️  Purge : cotisations du mois + cotisations mensuelles + paiements + avoirs + assistances\n");
  console.log(`📌 Périmètre : ${label}\n`);
  console.log("⚠️  ATTENTION : opération irréversible.\n");
  console.log("Conservé : dettes initiales uniquement.\n");

  const isFiltered = scope !== "all";
  const whereAdherent = isFiltered ? { adherentId: { in: adherentIds } } : {};

  if (isFiltered) {
    const existing = await prisma.adherent.findMany({
      where: { id: { in: adherentIds } },
      select: { id: true, firstname: true, lastname: true },
    });
    if (existing.length !== adherentIds.length) {
      const foundIds = new Set(existing.map((a) => a.id));
      const missing = adherentIds.filter((id) => !foundIds.has(id));
      console.error(`❌ Adhérent(s) introuvable(s) : ${missing.join(", ")}`);
      process.exit(1);
    }
    console.log("Adhérent(s) ciblé(s) :");
    existing.forEach((a) => console.log(`   - ${a.firstname} ${a.lastname} (${a.id})`));
    console.log("");
  }

  // Ids des cotisations mensuelles et avoirs concernés (pour UtilisationAvoir)
  let cotisationMensuelleIds: string[] = [];
  let avoirIds: string[] = [];
  if (isFiltered) {
    const cms = await prisma.cotisationMensuelle.findMany({
      where: { adherentId: { in: adherentIds } },
      select: { id: true },
    });
    cotisationMensuelleIds = cms.map((c) => c.id);
    const avs = await prisma.avoir.findMany({
      where: { adherentId: { in: adherentIds } },
      select: { id: true },
    });
    avoirIds = avs.map((a) => a.id);
  }

  const orClauses: Array<{ cotisationMensuelleId?: { in: string[] }; avoirId?: { in: string[] } }> = [];
  if (cotisationMensuelleIds.length) orClauses.push({ cotisationMensuelleId: { in: cotisationMensuelleIds } });
  if (avoirIds.length) orClauses.push({ avoirId: { in: avoirIds } });
  const whereUtilisationAvoir =
    isFiltered ? (orClauses.length ? { OR: orClauses } : { id: { in: [] } }) : {};

  const countUtilisations = await prisma.utilisationAvoir.count({ where: whereUtilisationAvoir });
  const countRelances = await prisma.relanceCotisationMensuelle.count({ where: whereAdherent });
  const countPaiements = await prisma.paiementCotisation.count({ where: whereAdherent });
  const countAssistances = await prisma.assistance.count({ where: whereAdherent });
  const countCotisationsMensuelles = await prisma.cotisationMensuelle.count({ where: whereAdherent });
  const countCotisationsDuMois = isFiltered ? 0 : await prisma.cotisationDuMois.count();
  const countAvoirs = await prisma.avoir.count({ where: whereAdherent });

  console.log("📊 À supprimer :");
  console.log(`   - Utilisations d'avoirs : ${countUtilisations}`);
  console.log(`   - Relances cotisations mensuelles : ${countRelances}`);
  console.log(`   - Paiements : ${countPaiements}`);
  console.log(`   - Assistances : ${countAssistances}`);
  console.log(`   - Cotisations mensuelles : ${countCotisationsMensuelles}`);
  if (!isFiltered) console.log(`   - Cotisations du mois : ${countCotisationsDuMois}`);
  console.log(`   - Avoirs : ${countAvoirs}\n`);

  const total =
    countUtilisations +
    countRelances +
    countPaiements +
    countAssistances +
    countCotisationsMensuelles +
    countCotisationsDuMois +
    countAvoirs;
  if (total === 0 && isFiltered) {
    console.log("✅ Rien à purger.");
    return;
  }
  if (total === 0 && !isFiltered) {
    console.log("✅ Rien à purger (cotisations / paiements / avoirs / etc.).");
    const resetDettes = await prisma.detteInitiale.updateMany({
      data: { montantPaye: new Decimal(0) },
    });
    console.log(`   ✓ Dettes initiales : montantPaye réinitialisé à 0 (${resetDettes.count} ligne(s))\n`);
    return;
  }

  const u = await prisma.utilisationAvoir.deleteMany({ where: whereUtilisationAvoir });
  console.log(`   ✓ ${u.count} utilisation(s) d'avoir(s) supprimée(s)`);

  const r = await prisma.relanceCotisationMensuelle.deleteMany({ where: whereAdherent });
  console.log(`   ✓ ${r.count} relance(s) supprimée(s)`);

  const p = await prisma.paiementCotisation.deleteMany({ where: whereAdherent });
  console.log(`   ✓ ${p.count} paiement(s) supprimé(s)`);

  const ass = await prisma.assistance.deleteMany({ where: whereAdherent });
  console.log(`   ✓ ${ass.count} assistance(s) supprimée(s)`);

  const cm = await prisma.cotisationMensuelle.deleteMany({ where: whereAdherent });
  console.log(`   ✓ ${cm.count} cotisation(s) mensuelle(s) supprimée(s)`);

  if (!isFiltered) {
    const cdm = await prisma.cotisationDuMois.deleteMany({});
    console.log(`   ✓ ${cdm.count} cotisation(s) du mois supprimée(s)`);
  }

  const av = await prisma.avoir.deleteMany({ where: whereAdherent });
  console.log(`   ✓ ${av.count} avoir(s) supprimé(s)`);

  if (!isFiltered) {
    const resetDettes = await prisma.detteInitiale.updateMany({
      data: { montantPaye: new Decimal(0) },
    });
    console.log(`   ✓ Dettes initiales : montantPaye réinitialisé à 0 (${resetDettes.count} ligne(s))\n`);
  } else {
    console.log("");
  }

  const remainingP = await prisma.paiementCotisation.count({ where: whereAdherent });
  const remainingAss = await prisma.assistance.count({ where: whereAdherent });
  const remainingCM = await prisma.cotisationMensuelle.count({ where: whereAdherent });
  const remainingA = await prisma.avoir.count({ where: whereAdherent });
  const remainingCDM = isFiltered ? await prisma.cotisationDuMois.count() : 0;

  console.log("📊 Vérification :");
  console.log(`   - Paiements restants (périmètre) : ${remainingP}`);
  console.log(`   - Assistances restantes (périmètre) : ${remainingAss}`);
  console.log(`   - Cotisations mensuelles restantes (périmètre) : ${remainingCM}`);
  console.log(`   - Avoirs restants (périmètre) : ${remainingA}`);
  if (!isFiltered) console.log(`   - Cotisations du mois restantes : ${remainingCDM}`);
  console.log("");

  if (remainingP === 0 && remainingAss === 0 && remainingCM === 0 && remainingA === 0 && (isFiltered || remainingCDM === 0)) {
    console.log("✅ Purge terminée. Seules les dettes initiales sont conservées (et cotisations du mois si périmètre partiel).");
  } else {
    console.log("⚠️  Certaines lignes n'ont pas été supprimées.");
  }
}

purge()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
