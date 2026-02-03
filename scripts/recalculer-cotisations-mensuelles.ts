/**
 * Script pour recalculer automatiquement les cotisations mensuelles existantes
 * 
 * Ce script corrige les montants des cotisations mensuelles en utilisant la nouvelle logique :
 * - Le forfait est identifié par aBeneficiaire === false
 * - Les assistances sont identifiées par aBeneficiaire === true
 * - Les bénéficiaires ne paient pas les assistances dont ils bénéficient
 * 
 * Usage: npx tsx scripts/recalculer-cotisations-mensuelles.ts [--periode YYYY-MM] [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { calculerCotisationMensuelle, buildDescriptionLigne } from '../lib/utils/cotisations';

const prisma = new PrismaClient();

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

/**
 * Recalcule le montant d'une cotisation mensuelle en utilisant la fonction utilitaire
 */
function recalculerCotisationMensuelle(
  cotisationMensuelle: any,
  periode: string,
  cotisationsDuMois: any[]
): {
  montantAttendu: number;
  montantRestant: number;
  description: string;
} {
  // Utiliser la fonction utilitaire pour calculer le montant et générer la description
  const result = calculerCotisationMensuelle(
    cotisationMensuelle.adherentId,
    periode,
    cotisationsDuMois.map(cdm => ({
      id: cdm.id,
      periode: cdm.periode,
      montantBase: Number(cdm.montantBase),
      adherentBeneficiaireId: cdm.adherentBeneficiaireId,
      TypeCotisation: {
        id: cdm.TypeCotisation.id,
        nom: cdm.TypeCotisation.nom || "Assistance",
        aBeneficiaire: cdm.TypeCotisation.aBeneficiaire || false,
      },
      AdherentBeneficiaire: cdm.AdherentBeneficiaire || null,
    }))
  );

  // Calculer le nouveau montant restant
  const montantPaye = Number(cotisationMensuelle.montantPaye);
  const nouveauMontantRestant = Math.max(0, result.montantTotal - montantPaye);

  return {
    montantAttendu: result.montantTotal,
    montantRestant: nouveauMontantRestant,
    description: result.description,
  };
}

/**
 * Recalcule toutes les cotisations mensuelles pour une période donnée
 */
async function recalculerCotisationsPourPeriode(periode: string, dryRun: boolean = false) {
  logInfo(`\n📅 Traitement de la période: ${periode}`);

  // Récupérer toutes les cotisations du mois pour cette période
  const cotisationsDuMois = await prisma.cotisationDuMois.findMany({
    where: {
      periode,
      statut: { not: "Annule" }, // Exclure les cotisations annulées
    },
    include: {
      TypeCotisation: {
        select: {
          id: true,
          nom: true,
          montant: true,
          obligatoire: true,
          aBeneficiaire: true,
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
    orderBy: [
      { TypeCotisation: { ordre: 'asc' } },
    ],
  });

  if (cotisationsDuMois.length === 0) {
    logWarning(`Aucune cotisation du mois trouvée pour la période ${periode}`);
    return { updated: 0, errors: 0 };
  }

  // Vérifier qu'il y a un forfait
  const cotisationForfait = cotisationsDuMois.find(cdm => 
    !cdm.TypeCotisation?.aBeneficiaire
  );

  if (!cotisationForfait) {
    logError(`Cotisation forfaitaire non trouvée pour la période ${periode}`);
    return { updated: 0, errors: 1 };
  }

  const cotisationsAssistances = cotisationsDuMois.filter(cdm => 
    cdm.TypeCotisation?.aBeneficiaire === true
  );

  logInfo(`  Forfait: ${cotisationForfait.TypeCotisation?.nom} (${Number(cotisationForfait.montantBase).toFixed(2)}€)`);
  logInfo(`  Assistances: ${cotisationsAssistances.length} trouvée(s)`);

  // Récupérer toutes les cotisations mensuelles pour cette période
  const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
    where: {
      periode,
    },
    include: {
      Adherent: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
        },
      },
    },
    orderBy: {
      Adherent: {
        lastname: 'asc',
      },
    },
  });

  if (cotisationsMensuelles.length === 0) {
    logWarning(`Aucune cotisation mensuelle trouvée pour la période ${periode}`);
    return { updated: 0, errors: 0 };
  }

  logInfo(`  Cotisations mensuelles à traiter: ${cotisationsMensuelles.length}`);

  let updated = 0;
  let errors = 0;
  let totalDifference = 0;

      for (const cotisationMensuelle of cotisationsMensuelles) {
        try {
          const ancienMontant = Number(cotisationMensuelle.montantAttendu);
          
          const { montantAttendu, montantRestant, description } = 
            recalculerCotisationMensuelle(
              cotisationMensuelle,
              periode,
              cotisationsDuMois
            );

          // Description de la ligne : type + (Civilite Prénom Nom bénéficiaire) ou (montant€)
          const cdm = cotisationsDuMois.find((cdm: any) => cdm.id === cotisationMensuelle.cotisationDuMoisId);
          const descriptionLigne = cdm
            ? buildDescriptionLigne(
                cdm.TypeCotisation?.nom ?? "Cotisation",
                cdm.TypeCotisation?.aBeneficiaire ?? false,
                Number(cdm.montantBase),
                cdm.AdherentBeneficiaire ?? null
              )
            : description;

      const difference = montantAttendu - ancienMontant;

      if (difference !== 0 || cotisationMensuelle.description !== descriptionLigne) {
        logInfo(
          `  ${cotisationMensuelle.Adherent.firstname} ${cotisationMensuelle.Adherent.lastname}: ` +
          `${ancienMontant.toFixed(2)}€ → ${montantAttendu.toFixed(2)}€ ` +
          `(${difference > 0 ? '+' : ''}${difference.toFixed(2)}€)`
        );

        if (!dryRun) {
          // Mettre à jour le statut en fonction du montant restant
          let nouveauStatut = cotisationMensuelle.statut;
          const montantPaye = Number(cotisationMensuelle.montantPaye);
          
          if (montantRestant <= 0) {
            nouveauStatut = "Paye";
          } else if (montantPaye > 0) {
            nouveauStatut = "PartiellementPaye";
          } else {
            nouveauStatut = cotisationMensuelle.statut === "EnRetard" ? "EnRetard" : "EnAttente";
          }

          await prisma.cotisationMensuelle.update({
            where: { id: cotisationMensuelle.id },
            data: {
              montantAttendu: new Decimal(montantAttendu),
              montantRestant: new Decimal(montantRestant),
              description: descriptionLigne,
              statut: nouveauStatut,
            },
          });
        }

        updated++;
        totalDifference += difference;
      }
    } catch (error) {
      logError(
        `  Erreur pour ${cotisationMensuelle.Adherent.firstname} ${cotisationMensuelle.Adherent.lastname}: ` +
        `${error instanceof Error ? error.message : 'Erreur inconnue'}`
      );
      errors++;
    }
  }

  if (updated > 0) {
    logSuccess(
      `  ${updated} cotisation(s) ${dryRun ? 'seraient mises à jour' : 'mise(s) à jour'} ` +
      `(différence totale: ${totalDifference > 0 ? '+' : ''}${totalDifference.toFixed(2)}€)`
    );
  } else {
    logInfo(`  Aucune modification nécessaire pour cette période`);
  }

  return { updated, errors };
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  const periodeArg = args.find(arg => arg.startsWith('--periode='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    logWarning('🔍 MODE DRY-RUN: Aucune modification ne sera effectuée');
  }

  try {
    log('\n🔄 Recalcul des cotisations mensuelles', 'bright');

    if (periodeArg) {
      // Recalculer pour une période spécifique
      logInfo(`Période spécifiée: ${periodeArg}`);
      const result = await recalculerCotisationsPourPeriode(periodeArg, dryRun);
      log(`\n📊 Résultat: ${result.updated} mise(s) à jour, ${result.errors} erreur(s)`);
    } else {
      // Recalculer pour toutes les périodes
      logInfo('Récupération de toutes les périodes...');
      
      const periodes = await prisma.cotisationMensuelle.findMany({
        select: {
          periode: true,
        },
        distinct: ['periode'],
        orderBy: {
          periode: 'desc',
        },
      });

      if (periodes.length === 0) {
        logWarning('Aucune cotisation mensuelle trouvée');
        return;
      }

      logInfo(`${periodes.length} période(s) trouvée(s)\n`);

      let totalUpdated = 0;
      let totalErrors = 0;

      for (const { periode } of periodes) {
        const result = await recalculerCotisationsPourPeriode(periode, dryRun);
        totalUpdated += result.updated;
        totalErrors += result.errors;
      }

      log(`\n📊 Résultat global: ${totalUpdated} mise(s) à jour, ${totalErrors} erreur(s)`, 'bright');
    }

    if (dryRun) {
      logWarning('\n⚠️  MODE DRY-RUN: Aucune modification n\'a été effectuée');
      logInfo('Pour appliquer les modifications, relancez le script sans --dry-run');
    } else {
      logSuccess('\n✅ Recalcul terminé avec succès');
    }
  } catch (error) {
    logError(`\n❌ Erreur fatale: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
main();
