/**
 * DTO publics notes de frais — jamais de cheminRelatif / cheminStockage.
 */

import { computeEtatFinancierNoteFrais } from "@/lib/services/frais-avances/note-frais-remboursement-service";
import { parseMoneyToCents } from "@/lib/frais-avances/money-cents";

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
  /** Présent uniquement pour Actif ADMIN|TRESOR|COMCPT — omis sinon (pas `undefined`). */
  reference?: string;
};

/** Entrée d'historique de règlement (simples ou mixte groupé). */
export type NoteFraisHistoriqueReglementDto = {
  kind: "REMBOURSEMENT_SIMPLE" | "COMPENSATION_SIMPLE" | "MIXTE";
  id: string;
  executeAt: string;
  montantRemboursement?: string;
  montantCompensation?: string;
  moyen?: string;
  executeurLabel?: string | null;
  cibles?: Array<{
    libelle: string;
    montant: string;
    typeCible: string;
  }>;
  /** Uniquement si droit financier — clé absente sinon. */
  reference?: string;
};

export type NoteFraisChoixHistoriqueDto = {
  id: string;
  mode: string;
  statut: string;
  montantRemboursement: string;
  montantCompensation: string;
  choisiAt: string;
  remplaceChoixId: string | null;
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
  /** Historique des choix (ACTIF + REMPLACE), ACTIF en tête. */
  ChoixHistorique?: NoteFraisChoixHistoriqueDto[];
  /** Remplacement possible uniquement si compteurs utilisés = 0. */
  canReplaceChoix?: boolean;
  etatFinancier?: "NON_REGLEE" | "PARTIELLEMENT_REGLEE" | "REGLEE";
  /** Présent si compteurs incohérents (consommé > accepté) — jamais classé REGLEE. */
  alerteEtatFinancier?: boolean;
  restantDu?: string;
  consomme?: string;
  /** Indicateur liste (sans charger les PJ). */
  justificatifsReadyCount?: number;
  /** @deprecated préférer `historiqueReglements` */
  Remboursements?: NoteFraisRemboursementPublicDto[];
  /** Historique groupé : pas de double comptage parent/enfants. */
  historiqueReglements?: NoteFraisHistoriqueReglementDto[];
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
 * Enrichit le DTO avec état financier et historique (référence selon droit).
 * Les enfants d'une opération MIXTE ne sont pas listés séparément.
 *
 * @param dto - DTO de base
 * @param opts.includeReference - true pour ADMIN|TRESOR|COMCPT
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
      operationId?: string | null;
      executeurLabel?: string | null;
    }>;
    compensations?: Array<{
      id: string;
      montantTotal: { toString(): string } | number | string;
      executeAt: Date;
      operationId?: string | null;
      executeurLabel?: string | null;
      Lignes?: Array<{
        typeCible: string | null;
        montant: { toString(): string } | number | string;
        libelleSnapshot?: string | null;
      }>;
    }>;
    operationsMixte?: Array<{
      id: string;
      executeAt: Date;
      executeurLabel?: string | null;
      compensationMontant: string;
      remboursementMontant: string;
      moyen: string;
      reference: string | null;
      cibles?: Array<{
        libelle: string;
        montant: string;
        typeCible: string;
      }>;
    }>;
    choixHistorique?: NoteFraisChoixHistoriqueDto[];
  }
): NoteFraisPublicDto {
  const choix = dto.ChoixReglementActif;
  if (dto.montantAccepte != null && choix) {
    try {
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
        alerteEtatFinancier: false,
        canReplaceChoix: (() => {
          try {
            return (
              parseMoneyToCents(String(choix.montantRembourseUtilise)) === 0 &&
              parseMoneyToCents(String(choix.montantCompensationUtilise)) === 0
            );
          } catch {
            return false;
          }
        })(),
      };
    } catch {
      dto = {
        ...dto,
        alerteEtatFinancier: true,
        canReplaceChoix: false,
      };
    }
  }

  if (opts.choixHistorique && opts.choixHistorique.length > 0) {
    dto = { ...dto, ChoixHistorique: opts.choixHistorique };
  }

  const historique: NoteFraisHistoriqueReglementDto[] = [];

  for (const op of opts.operationsMixte ?? []) {
    const entry: NoteFraisHistoriqueReglementDto = {
      kind: "MIXTE",
      id: op.id,
      executeAt: op.executeAt.toISOString(),
      montantRemboursement: op.remboursementMontant,
      montantCompensation: op.compensationMontant,
      moyen: op.moyen,
      executeurLabel: op.executeurLabel ?? null,
      cibles: op.cibles,
    };
    if (opts.includeReference && op.reference) {
      entry.reference = op.reference;
    }
    historique.push(entry);
  }

  const mixteChildIds = new Set(
    (opts.operationsMixte ?? []).flatMap(() => [] as string[])
  );
  // Les IDs enfants ne sont pas nécessaires si on filtre via operationId null.
  void mixteChildIds;

  for (const r of opts.remboursements ?? []) {
    if (r.operationId) continue; // enfant mixte → déjà dans parent
    const entry: NoteFraisHistoriqueReglementDto = {
      kind: "REMBOURSEMENT_SIMPLE",
      id: r.id,
      executeAt: r.executeAt.toISOString(),
      montantRemboursement: decimalToString(r.montantTotal) ?? "0",
      moyen: r.moyen ?? "",
      executeurLabel: r.executeurLabel ?? null,
    };
    if (opts.includeReference && r.reference) {
      entry.reference = r.reference;
    }
    historique.push(entry);
  }

  for (const c of opts.compensations ?? []) {
    if (c.operationId) continue;
    historique.push({
      kind: "COMPENSATION_SIMPLE",
      id: c.id,
      executeAt: c.executeAt.toISOString(),
      montantCompensation: decimalToString(c.montantTotal) ?? "0",
      executeurLabel: c.executeurLabel ?? null,
      cibles: (c.Lignes ?? [])
        .filter((l) => l.typeCible)
        .map((l) => ({
          typeCible: l.typeCible!,
          libelle: l.libelleSnapshot?.trim() || l.typeCible!,
          montant: decimalToString(l.montant) ?? "0",
        })),
    });
  }

  historique.sort(
    (a, b) => new Date(a.executeAt).getTime() - new Date(b.executeAt).getTime()
  );

  if (historique.length > 0) {
    dto = { ...dto, historiqueReglements: historique };
  }

  // Compat tests : remboursements simples (+ mixte enfants uniquement si includeRef admin list flat)
  const rembFlat = (opts.remboursements ?? []).filter((r) => !r.operationId);
  if (rembFlat.length > 0) {
    dto = {
      ...dto,
      Remboursements: rembFlat.map((r) => {
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
