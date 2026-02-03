/**
 * Met à jour la colonne description des cotisations_mensuelles de type assistance :
 * remplace la concaténation avec le montant par "Type (Civilité Prénom Nom)" de l'adhérent bénéficiaire.
 * Exemple : "Assistance décès (Monsieur José Nkashama)".
 *
 * Usage: npx tsx scripts/update-cotisations-mensuelles-description-beneficiaire.ts [--dry-run]
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

function libelleCivilite(civility: string | null | undefined): string {
  if (!civility) return "";
  const c = String(civility);
  if (["Monsieur", "Madame", "Mademoiselle", "Partenaire"].includes(c)) return c;
  return c;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    log("Mode --dry-run : aucune modification ne sera effectuée.", "yellow");
  }

  // Cotisations mensuelles liées à une CotisationDuMois avec bénéficiaire (type assistance)
  const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
    where: { cotisationDuMoisId: { not: null } },
    include: {
      TypeCotisation: {
        select: {
          id: true,
          nom: true,
          aBeneficiaire: true,
        },
      },
      CotisationDuMois: {
        include: {
          AdherentBeneficiaire: {
            select: {
              id: true,
              civility: true,
              firstname: true,
              lastname: true,
            },
          },
        },
      },
      AdherentBeneficiaire: {
        select: {
          id: true,
          civility: true,
          firstname: true,
          lastname: true,
        },
      },
    },
  });

  const isAssistance = (cm: (typeof cotisationsMensuelles)[0]) =>
    cm.TypeCotisation?.aBeneficiaire === true ||
    (cm.CotisationDuMois?.adherentBeneficiaireId != null);

  const toUpdate: Array<{
    id: string;
    newDescription: string;
    currentDescription: string | null;
  }> = [];

  for (const cm of cotisationsMensuelles) {
    if (!isAssistance(cm)) continue;
    const benef =
      cm.AdherentBeneficiaire ?? cm.CotisationDuMois?.AdherentBeneficiaire;
    if (!benef) continue;
    const civilite = libelleCivilite(benef.civility);
    const nomComplet = [civilite, benef.firstname, benef.lastname]
      .filter(Boolean)
      .join(" ");
    const newDescription = `${cm.TypeCotisation?.nom ?? "Assistance"} (${nomComplet})`;
    if (cm.description !== newDescription) {
      toUpdate.push({
        id: cm.id,
        newDescription,
        currentDescription: cm.description,
      });
    }
  }

  log(
    `Cotisations mensuelles liées à une CotisationDuMois : ${cotisationsMensuelles.length}`,
    "cyan"
  );
  log(
    `Dont type assistance avec bénéficiaire : ${cotisationsMensuelles.filter((cm) => isAssistance(cm) && (cm.AdherentBeneficiaire ?? cm.CotisationDuMois?.AdherentBeneficiaire)).length}`,
    "cyan"
  );
  log(`À mettre à jour (description) : ${toUpdate.length}`, toUpdate.length ? "yellow" : "cyan");

  if (toUpdate.length === 0) {
    log("Rien à mettre à jour.", "green");
    return;
  }

  for (const { id, newDescription, currentDescription } of toUpdate) {
    if (!dryRun) {
      await prisma.cotisationMensuelle.update({
        where: { id },
        data: { description: newDescription },
      });
    }
    log(
      `  ${dryRun ? "[dry-run] " : ""}${id}: "${currentDescription ?? ""}" → "${newDescription}"`,
      "reset"
    );
  }

  log(
    dryRun
      ? `[dry-run] ${toUpdate.length} enregistrement(s) seraient mis à jour.`
      : `${toUpdate.length} enregistrement(s) mis à jour.`,
    "green"
  );
}

main()
  .catch((e) => {
    console.error(colors.red, e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
