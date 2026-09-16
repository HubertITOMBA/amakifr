/**
 * DTO publics notes de frais — jamais de cheminRelatif / cheminStockage.
 */

import { computeEtatFinancierNoteFrais } from "@/lib/services/frais-avances/note-frais-remboursement-service";

export type JustificatifNoteFraisPublicDto = {
  id: string;
  nomFichierOrig: string;
  typeMime: string;
  taille: number;
  statut: string;
  createdAt: Date | string;
};

export type NoteFraisDecisionPublicDto = {
  statutFinal: string;
  montantDemande: string | number;
  montantAccepte: string | number | null;
  motif: string | null;
  decideeAt: Date | string;
  decideurUserId: string | null;
};

export type NoteFraisChoixReglementCiblePublicDto = {
  typeCible: string;
  cibleId: string;
  montantAutorise: string | number;
  montantUtilise: string | number;
  montantRestantSnapshot: string | number;
  libelleSnapshot: string | null;
  rang: number;
};

export type NoteFraisChoixReglementPublicDto = {
  id: string;
  mode: string;
  statut: string;
  montantReference: string | number;
  montantRemboursement: string | number;
  montantCompensation: string | number;
  montantRembourseUtilise: string | number;
  montantCompensationUtilise: string | number;
  remplaceChoixId: string | null;
  choisiAt: Date | string;
  Cibles: NoteFraisChoixReglementCiblePublicDto[];
};

export type NoteFraisRemboursementPublicDto = {
  id: string;
  montantTotal: string;
  moyen: string;
  executeAt: Date | string;
  /** Présent uniquement pour Actif ADMIN|TRESOR|COMCPT. */
  reference?: string;
};

export type NoteFraisPublicDto = {
  id: string;
  libelle: string;
  description: string | null;
  dateDepense: Date | string;
  montantDemande: string | number;
  statut: string;
  version: number;
  soumiseAt: Date | string | null;
  alerteSansDestinataire: boolean;
  montantAccepte: string | number | null;
  motifDecision: string | null;
  decideeAt: Date | string | null;
  decideurUserId: string | null;
  corrigeNoteFraisId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  Justificatifs: JustificatifNoteFraisPublicDto[];
  Decision?: NoteFraisDecisionPublicDto | null;
  ChoixReglementActif?: NoteFraisChoixReglementPublicDto | null;
  /** État financier calculé (lot 4.2) — absent si pas de montant accepté / choix. */
  etatFinancier?: "NON_REGLEE" | "PARTIELLEMENT_REGLEE" | "REGLEE";
  restantDu?: string;
  consomme?: string;
  Remboursements?: NoteFraisRemboursementPublicDto[];
  Demandeur?: { id: string; email: string | null; name: string | null };
  Adherent?: { id: string; firstname: string; lastname: string };
};

type JustificatifRow = {
  id: string;
  nomFichierOrig: string;
  typeMime: string;
  taille: number;
  statut: string;
  createdAt: Date;
  cheminRelatif?: string;
};

type DecisionRow = {
  statutFinal: string;
  montantDemande: { toString(): string } | number | string;
  montantAccepte: { toString(): string } | number | string | null;
  motif: string | null;
  decideeAt: Date;
  decideurUserId: string | null;
};

type NoteRow = {
  id: string;
  libelle: string;
  description: string | null;
  dateDepense: Date;
  montantDemande: { toString(): string } | number | string;
  statut: string;
  version: number;
  soumiseAt: Date | null;
  alerteSansDestinataire: boolean;
  montantAccepte?: { toString(): string } | number | string | null;
  motifDecision?: string | null;
  decideeAt?: Date | null;
  decideurUserId?: string | null;
  corrigeNoteFraisId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  Justificatifs?: JustificatifRow[];
  Decision?: DecisionRow | null;
  ChoixReglements?: Array<{
    id: string;
    mode: string;
    statut: string;
    montantReference: { toString(): string } | number | string;
    montantRemboursement: { toString(): string } | number | string;
    montantCompensation: { toString(): string } | number | string;
    montantRembourseUtilise: { toString(): string } | number | string;
    montantCompensationUtilise: { toString(): string } | number | string;
    remplaceChoixId: string | null;
    choisiAt: Date;
    Cibles?: Array<{
      typeCible: string;
      cibleId: string;
      montantAutorise: { toString(): string } | number | string;
      montantUtilise: { toString(): string } | number | string;
      montantRestantSnapshot: { toString(): string } | number | string;
      libelleSnapshot: string | null;
      rang: number;
    }>;
  }>;
  Demandeur?: { id: string; email: string | null; name: string | null };
  Adherent?: { id: string; firstname: string; lastname: string };
};

function decimalToString(
  value: { toString(): string } | number | string | null | undefined
): string | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return value.toString();
  }
  return String(value);
}

/**
 * Mappe un justificatif vers un DTO sans chemin de stockage.
 */
export function toJustificatifPublicDto(
  j: JustificatifRow
): JustificatifNoteFraisPublicDto {
  return {
    id: j.id,
    nomFichierOrig: j.nomFichierOrig,
    typeMime: j.typeMime,
    taille: j.taille,
    statut: j.statut,
    createdAt: j.createdAt,
  };
}

/**
 * Mappe le journal de décision vers un DTO public.
 */
export function toNoteFraisDecisionPublicDto(
  d: DecisionRow
): NoteFraisDecisionPublicDto {
  return {
    statutFinal: d.statutFinal,
    montantDemande: decimalToString(d.montantDemande) ?? "0",
    montantAccepte: decimalToString(d.montantAccepte),
    motif: d.motif,
    decideeAt: d.decideeAt,
    decideurUserId: d.decideurUserId,
  };
}

/**
 * Mappe le choix ACTIF vers un DTO public.
 */
export function toNoteFraisChoixReglementPublicDto(row: {
  id: string;
  mode: string;
  statut: string;
  montantReference: { toString(): string } | number | string;
  montantRemboursement: { toString(): string } | number | string;
  montantCompensation: { toString(): string } | number | string;
  montantRembourseUtilise: { toString(): string } | number | string;
  montantCompensationUtilise: { toString(): string } | number | string;
  remplaceChoixId: string | null;
  choisiAt: Date;
  Cibles?: Array<{
    typeCible: string;
    cibleId: string;
    montantAutorise: { toString(): string } | number | string;
    montantUtilise: { toString(): string } | number | string;
    montantRestantSnapshot: { toString(): string } | number | string;
    libelleSnapshot: string | null;
    rang: number;
  }>;
}): NoteFraisChoixReglementPublicDto {
  return {
    id: row.id,
    mode: row.mode,
    statut: row.statut,
    montantReference: decimalToString(row.montantReference) ?? "0",
    montantRemboursement: decimalToString(row.montantRemboursement) ?? "0",
    montantCompensation: decimalToString(row.montantCompensation) ?? "0",
    montantRembourseUtilise:
      decimalToString(row.montantRembourseUtilise) ?? "0",
    montantCompensationUtilise:
      decimalToString(row.montantCompensationUtilise) ?? "0",
    remplaceChoixId: row.remplaceChoixId,
    choisiAt: row.choisiAt,
    Cibles: (row.Cibles ?? [])
      .slice()
      .sort((a, b) => a.rang - b.rang)
      .map((c) => ({
        typeCible: c.typeCible,
        cibleId: c.cibleId,
        montantAutorise: decimalToString(c.montantAutorise) ?? "0",
        montantUtilise: decimalToString(c.montantUtilise) ?? "0",
        montantRestantSnapshot:
          decimalToString(c.montantRestantSnapshot) ?? "0",
        libelleSnapshot: c.libelleSnapshot,
        rang: c.rang,
      })),
  };
}

/**
 * Mappe une note vers un DTO public (sans chemins fichier).
 */
export function toNoteFraisPublicDto(note: NoteRow): NoteFraisPublicDto {
  const choixActif = (note.ChoixReglements ?? []).find(
    (c) => c.statut === "ACTIF"
  );
  return {
    id: note.id,
    libelle: note.libelle,
    description: note.description,
    dateDepense: note.dateDepense,
    montantDemande: decimalToString(note.montantDemande) ?? "0",
    statut: note.statut,
    version: note.version,
    soumiseAt: note.soumiseAt,
    alerteSansDestinataire: note.alerteSansDestinataire,
    montantAccepte: decimalToString(note.montantAccepte ?? null),
    motifDecision: note.motifDecision ?? null,
    decideeAt: note.decideeAt ?? null,
    decideurUserId: note.decideurUserId ?? null,
    corrigeNoteFraisId: note.corrigeNoteFraisId ?? null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    Justificatifs: (note.Justificatifs ?? []).map(toJustificatifPublicDto),
    ...(note.Decision
      ? { Decision: toNoteFraisDecisionPublicDto(note.Decision) }
      : {}),
    ...(choixActif
      ? { ChoixReglementActif: toNoteFraisChoixReglementPublicDto(choixActif) }
      : {}),
    ...(note.Demandeur ? { Demandeur: note.Demandeur } : {}),
    ...(note.Adherent ? { Adherent: note.Adherent } : {}),
  };
}

/**
 * Enrichit le DTO avec état financier et remboursements (référence selon droit).
 *
 * @param dto - DTO de base
 * @param opts.includeReference - true pour ADMIN|TRESOR|COMCPT
 * @param opts.remboursements - règlements REMBOURSEMENT EXECUTE
 */
export function enrichNoteFraisFinancierDto(
  dto: NoteFraisPublicDto,
  opts: {
    includeReference: boolean;
    remboursements?: Array<{
      id: string;
      montantTotal: { toString(): string } | number | string;
      moyen: string | null;
      reference: string | null;
      executeAt: Date;
    }>;
  }
): NoteFraisPublicDto {
  const choix = dto.ChoixReglementActif;
  if (dto.montantAccepte != null && choix) {
    const etat = computeEtatFinancierNoteFrais({
      montantAccepte: dto.montantAccepte,
      montantRembourseUtilise: choix.montantRembourseUtilise,
      montantCompensationUtilise: choix.montantCompensationUtilise,
    });
    dto = {
      ...dto,
      etatFinancier: etat.etatFinancier,
      restantDu: etat.restantDu,
      consomme: etat.consomme,
    };
  }
  if (opts.remboursements && opts.remboursements.length > 0) {
    dto = {
      ...dto,
      Remboursements: opts.remboursements.map((r) => {
        const base: NoteFraisRemboursementPublicDto = {
          id: r.id,
          montantTotal: decimalToString(r.montantTotal) ?? "0",
          moyen: r.moyen ?? "",
          executeAt: r.executeAt,
        };
        if (opts.includeReference && r.reference) {
          base.reference = r.reference;
        }
        return base;
      }),
    };
  }
  return dto;
}

/** DTO archive privée — sans chemins ; notice de non-anonymat. */
export type JustificatifNoteFraisArchivePublicDto = {
  id: string;
  nomFichierOrig: string;
  typeMime: string;
  taille: number;
  statut: string;
  createdAt: Date | string;
};

export type NoteFraisArchivePublicDto = {
  id: string;
  dateDepense: Date | string;
  montantDemande: string | number;
  soumiseAt: Date | string;
  statutFinal: string;
  montantAccepte: string | number | null;
  decideeAt: Date | string | null;
  modeReglement: string | null;
  montantRemboursementChoix: string | number | null;
  montantCompensationChoix: string | number | null;
  archivedAt: Date | string;
  retentionEndsAt: Date | string;
  reidentifiabilityNotice: string;
  Justificatifs: JustificatifNoteFraisArchivePublicDto[];
};

/**
 * Mappe une archive vers un DTO sans chemin de stockage.
 */
export function toNoteFraisArchivePublicDto(row: {
  id: string;
  dateDepense: Date;
  montantDemande: { toString(): string } | number | string;
  soumiseAt: Date;
  statutFinal: string;
  montantAccepte?: { toString(): string } | number | string | null;
  decideeAt?: Date | null;
  modeReglement?: string | null;
  montantRemboursementChoix?: { toString(): string } | number | string | null;
  montantCompensationChoix?: { toString(): string } | number | string | null;
  archivedAt: Date;
  retentionEndsAt: Date;
  reidentifiabilityNotice: string;
  Justificatifs?: Array<{
    id: string;
    nomFichierOrig: string;
    typeMime: string;
    taille: number;
    statut: string;
    createdAt: Date;
    cheminRelatif?: string;
  }>;
}): NoteFraisArchivePublicDto {
  return {
    id: row.id,
    dateDepense: row.dateDepense,
    montantDemande: decimalToString(row.montantDemande) ?? "0",
    soumiseAt: row.soumiseAt,
    statutFinal: row.statutFinal,
    montantAccepte: decimalToString(row.montantAccepte ?? null),
    decideeAt: row.decideeAt ?? null,
    modeReglement: row.modeReglement ?? null,
    montantRemboursementChoix: decimalToString(
      row.montantRemboursementChoix ?? null
    ),
    montantCompensationChoix: decimalToString(
      row.montantCompensationChoix ?? null
    ),
    archivedAt: row.archivedAt,
    retentionEndsAt: row.retentionEndsAt,
    reidentifiabilityNotice: row.reidentifiabilityNotice,
    Justificatifs: (row.Justificatifs ?? []).map((j) => ({
      id: j.id,
      nomFichierOrig: j.nomFichierOrig,
      typeMime: j.typeMime,
      taille: j.taille,
      statut: j.statut,
      createdAt: j.createdAt,
    })),
  };
}
