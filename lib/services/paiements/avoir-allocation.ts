import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;

export type AvoirTargetType =
  | "cotisationMensuelle"
  | "detteInitiale"
  | "assistance"
  | "obligationCotisation";

/**
 * Applique automatiquement les avoirs disponibles sur une cotisation/dette/assistance.
 * Ordre : avoirs les plus anciens d'abord (createdAt asc).
 * Logique identique à actions/paiements.appliquerAvoirs.
 *
 * @returns Montant encore dû après application des avoirs
 */
export async function appliquerAvoirs(
  adherentId: string,
  montantDu: Prisma.Decimal,
  type: AvoirTargetType,
  id: string,
  client: DbClient = db
): Promise<Prisma.Decimal> {
  let montantRestant = new Prisma.Decimal(montantDu);
  const avoirsDisponibles = await client.avoir.findMany({
    where: {
      adherentId,
      statut: "Disponible",
      montantRestant: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const avoir of avoirsDisponibles) {
    if (montantRestant.lte(0)) break;

    const montantAUtiliser = Prisma.Decimal.min(
      avoir.montantRestant,
      montantRestant
    );
    const nouveauMontantUtilise = new Prisma.Decimal(avoir.montantUtilise).plus(
      montantAUtiliser
    );
    const nouveauMontantRestant = new Prisma.Decimal(avoir.montantRestant).minus(
      montantAUtiliser
    );
    const nouveauStatut = nouveauMontantRestant.lte(0)
      ? "Utilise"
      : "Disponible";

    await client.utilisationAvoir.create({
      data: {
        avoirId: avoir.id,
        montant: montantAUtiliser,
        cotisationMensuelleId: type === "cotisationMensuelle" ? id : null,
        obligationCotisationId: type === "obligationCotisation" ? id : null,
        detteInitialeId: type === "detteInitiale" ? id : null,
        assistanceId: type === "assistance" ? id : null,
        description: `Utilisation automatique pour ${type}`,
      },
    });

    await client.avoir.update({
      where: { id: avoir.id },
      data: {
        montantUtilise: nouveauMontantUtilise,
        montantRestant: nouveauMontantRestant,
        statut: nouveauStatut,
      },
    });

    montantRestant = montantRestant.minus(montantAUtiliser);
  }

  return montantRestant;
}

/**
 * Applique les avoirs disponibles sur les dettes initiales (annee asc).
 * Identique à actions/paiements.appliquerAvoirSurDettesInitiales.
 */
export async function appliquerAvoirSurDettesInitiales(
  adherentId: string,
  client: DbClient = db
): Promise<{ montantApplique: Prisma.Decimal }> {
  let montantApplique = new Prisma.Decimal(0);
  const dettes = await client.detteInitiale.findMany({
    where: { adherentId, montantRestant: { gt: 0 } },
    orderBy: { annee: "asc" },
  });

  for (const dette of dettes) {
    const montantDette = new Prisma.Decimal(dette.montantRestant);
    if (montantDette.lte(0)) continue;

    const montantRestantApresAvoirs = await appliquerAvoirs(
      adherentId,
      montantDette,
      "detteInitiale",
      dette.id,
      client
    );
    const avoirsUtilises = montantDette.minus(montantRestantApresAvoirs);
    if (avoirsUtilises.gt(0)) {
      montantApplique = montantApplique.plus(avoirsUtilises);
      const nouveauMontantPaye = new Prisma.Decimal(dette.montantPaye).plus(
        avoirsUtilises
      );
      await client.detteInitiale.update({
        where: { id: dette.id },
        data: { montantPaye: nouveauMontantPaye },
      });
    }
  }

  return { montantApplique };
}

export type SurplusAllocationExclude = {
  cotisationMensuelleId?: string | null;
  detteInitialeId?: string | null;
  assistanceId?: string | null;
};

/**
 * Ordre de ventilation des excédents (parcours adhérent AMAKI) :
 *
 * 1. DetteInitiale (annee ASC) — dettes antérieures historiques
 * 2. CotisationMensuelle ouvertes (dateEcheance ASC, id ASC)
 *    → forfaitaire + lignes catégorie Assistance (même table)
 * 3. Assistance entité legacy (dateEvenement ASC) si encore utilisée
 *
 * ObligationCotisation : hors parcours mobile/année (non incluse ici).
 * La cible déjà créditée par le paiement est exclue.
 *
 * Crédit direct (pas via Avoir) pour éviter un avoir prématuré.
 *
 * @returns Reliquat encore disponible après soldes (à transformer en Avoir)
 */
export async function allocateSurplusAcrossOpenDebts(
  client: DbClient,
  params: {
    adherentId: string;
    surplus: Prisma.Decimal;
    exclude?: SurplusAllocationExclude;
  }
): Promise<{
  remaining: Prisma.Decimal;
  appliedToDettesInitiales: Prisma.Decimal;
  appliedToCotisations: Prisma.Decimal;
  appliedToAssistances: Prisma.Decimal;
}> {
  let remaining = new Prisma.Decimal(params.surplus);
  let appliedToDettesInitiales = new Prisma.Decimal(0);
  let appliedToCotisations = new Prisma.Decimal(0);
  let appliedToAssistances = new Prisma.Decimal(0);

  if (remaining.lte(0)) {
    return {
      remaining,
      appliedToDettesInitiales,
      appliedToCotisations,
      appliedToAssistances,
    };
  }

  const excludeDette = params.exclude?.detteInitialeId ?? null;
  const excludeCot = params.exclude?.cotisationMensuelleId ?? null;
  const excludeAss = params.exclude?.assistanceId ?? null;

  // 1. Dettes antérieures
  const dettes = await client.detteInitiale.findMany({
    where: {
      adherentId: params.adherentId,
      montantRestant: { gt: 0 },
      ...(excludeDette ? { id: { not: excludeDette } } : {}),
    },
    orderBy: { annee: "asc" },
  });

  for (const dette of dettes) {
    if (remaining.lte(0)) break;
    const room = new Prisma.Decimal(dette.montantRestant);
    if (room.lte(0)) continue;
    const credit = Prisma.Decimal.min(remaining, room);
    if (credit.lte(0)) continue;
    const paye = new Prisma.Decimal(dette.montantPaye).plus(credit);
    await client.detteInitiale.update({
      where: { id: dette.id },
      data: { montantPaye: paye },
    });
    remaining = remaining.minus(credit);
    appliedToDettesInitiales = appliedToDettesInitiales.plus(credit);
  }

  // 2. Cotisations mensuelles (forfait + assistances CM)
  const cotisations = await client.cotisationMensuelle.findMany({
    where: {
      adherentId: params.adherentId,
      montantRestant: { gt: 0 },
      statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
      ...(excludeCot ? { id: { not: excludeCot } } : {}),
    },
    orderBy: [{ dateEcheance: "asc" }, { id: "asc" }],
  });

  for (const cot of cotisations) {
    if (remaining.lte(0)) break;
    const roomAttendu = new Prisma.Decimal(cot.montantAttendu).minus(
      cot.montantPaye
    );
    const room = Prisma.Decimal.min(
      new Prisma.Decimal(cot.montantRestant),
      roomAttendu.gt(0) ? roomAttendu : new Prisma.Decimal(0)
    );
    if (room.lte(0)) continue;
    const credit = Prisma.Decimal.min(remaining, room);
    if (credit.lte(0)) continue;
    const paye = new Prisma.Decimal(cot.montantPaye).plus(credit);
    const restantRaw = new Prisma.Decimal(cot.montantRestant).minus(credit);
    const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
    const statut = restant.lte(0)
      ? "Paye"
      : paye.gt(0)
        ? "PartiellementPaye"
        : "EnAttente";
    await client.cotisationMensuelle.update({
      where: { id: cot.id },
      data: { montantPaye: paye, montantRestant: restant, statut },
    });
    remaining = remaining.minus(credit);
    appliedToCotisations = appliedToCotisations.plus(credit);
  }

  // 3. Assistance entité (legacy)
  const assistances = await client.assistance.findMany({
    where: {
      adherentId: params.adherentId,
      montantRestant: { gt: 0 },
      statut: "EnAttente",
      ...(excludeAss ? { id: { not: excludeAss } } : {}),
    },
    orderBy: [{ dateEvenement: "asc" }, { id: "asc" }],
  });

  for (const ass of assistances) {
    if (remaining.lte(0)) break;
    const room = new Prisma.Decimal(ass.montantRestant);
    if (room.lte(0)) continue;
    const credit = Prisma.Decimal.min(remaining, room);
    if (credit.lte(0)) continue;
    const paye = new Prisma.Decimal(ass.montantPaye).plus(credit);
    const restantRaw = room.minus(credit);
    const restant = restantRaw.gt(0) ? restantRaw : new Prisma.Decimal(0);
    const statut = restant.lte(0) ? "Paye" : "EnAttente";
    await client.assistance.update({
      where: { id: ass.id },
      data: { montantPaye: paye, montantRestant: restant, statut },
    });
    remaining = remaining.minus(credit);
    appliedToAssistances = appliedToAssistances.plus(credit);
  }

  return {
    remaining,
    appliedToDettesInitiales,
    appliedToCotisations,
    appliedToAssistances,
  };
}

/**
 * Ventile l'excédent sur les dettes ouvertes, puis crée un Avoir uniquement
 * sur le reliquat (excédent réellement disponible pour le futur).
 */
export async function createAvoirFromPaymentSurplus(
  client: DbClient,
  params: {
    adherentId: string;
    paiementId: string;
    montant: Prisma.Decimal;
    exclude?: SurplusAllocationExclude;
  }
): Promise<{
  avoirId: string | null;
  montantInitial: string;
  montantAppliqueSurDettes: string;
  montantAvoirCree: string;
} | null> {
  if (params.montant.lte(0)) return null;

  const allocation = await allocateSurplusAcrossOpenDebts(client, {
    adherentId: params.adherentId,
    surplus: params.montant,
    exclude: params.exclude,
  });

  const appliedTotal = allocation.appliedToDettesInitiales
    .plus(allocation.appliedToCotisations)
    .plus(allocation.appliedToAssistances);

  let avoirId: string | null = null;
  if (allocation.remaining.gt(0)) {
    const avoir = await client.avoir.create({
      data: {
        adherentId: params.adherentId,
        montant: allocation.remaining,
        montantUtilise: new Prisma.Decimal(0),
        montantRestant: allocation.remaining,
        paiementId: params.paiementId,
        description: `Avoir créé suite à un excédent de paiement de ${allocation.remaining.toFixed(2)}€`,
        statut: "Disponible",
      },
    });
    avoirId = avoir.id;
  }

  return {
    avoirId,
    montantInitial: params.montant.toString(),
    montantAppliqueSurDettes: appliedTotal.toString(),
    montantAvoirCree: allocation.remaining.toString(),
  };
}
