/**
 * Script pour mettre à jour adherentBeneficiaireId dans cotisations_mensuelles
 * à partir de la CotisationDuMois liée lorsque le type est assistance (aBeneficiaire ou catégorie Assistance).
 *
 * Usage: npx tsx scripts/sync-adherent-beneficiaire-cotisations-mensuelles.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    log("Mode --dry-run : aucune modification ne sera effectuée.", "yellow");
  }

  // Cotisations mensuelles liées à une CotisationDuMois
  const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
    where: { cotisationDuMoisId: { not: null } },
    include: {
      CotisationDuMois: {
        include: {
          TypeCotisation: {
            select: {
              id: true,
              nom: true,
              aBeneficiaire: true,
              categorie: true,
            },
          },
        },
      },
    },
  });

  const isAssistance = (cm: (typeof cotisationsMensuelles)[0]) => {
    const type = cm.CotisationDuMois?.TypeCotisation;
    if (!type) return false;
    return type.aBeneficiaire === true || type.categorie === "Assistance";
  };

  const toUpdate = cotisationsMensuelles.filter((cm) => {
    if (!isAssistance(cm) || !cm.CotisationDuMois) return false;
    const expected = cm.CotisationDuMois.adherentBeneficiaireId ?? null;
    const current = cm.adherentBeneficiaireId ?? null;
    return current !== expected;
  });

  log(`Cotisations mensuelles liées à une CotisationDuMois : ${cotisationsMensuelles.length}`, "cyan");
  log(`Dont type assistance : ${cotisationsMensuelles.filter(isAssistance).length}`, "cyan");
  log(`À mettre à jour (adherentBeneficiaireId) : ${toUpdate.length}`, toUpdate.length ? "yellow" : "cyan");

  if (toUpdate.length === 0) {
    log("Rien à mettre à jour.", "green");
    return;
  }

  let updated = 0;
  for (const cm of toUpdate) {
    const cdm = cm.CotisationDuMois!;
    const newValue = cdm.adherentBeneficiaireId ?? null;
    if (!dryRun) {
      await prisma.cotisationMensuelle.update({
        where: { id: cm.id },
        data: { adherentBeneficiaireId: newValue },
      });
    }
    updated++;
    log(
      `  ${dryRun ? "[dry-run] " : ""}${cm.id} (période ${cm.periode}, adhérent ${cm.adherentId}) → adherentBeneficiaireId: ${newValue ?? "null"} (type: ${cdm.TypeCotisation?.nom})`,
      "reset"
    );
  }

  log(
    dryRun ? `[dry-run] ${updated} enregistrement(s) seraient mis à jour.` : `${updated} enregistrement(s) mis à jour.`,
    "green"
  );
}

main()
  .catch((e) => {
    console.error(colors.red, e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
