/**
 * DTO publics notes de frais — jamais de cheminRelatif / cheminStockage.
 */

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
 * Mappe une note vers un DTO public (sans chemins fichier).
 */
export function toNoteFraisPublicDto(note: NoteRow): NoteFraisPublicDto {
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
    ...(note.Demandeur ? { Demandeur: note.Demandeur } : {}),
    ...(note.Adherent ? { Adherent: note.Adherent } : {}),
  };
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
