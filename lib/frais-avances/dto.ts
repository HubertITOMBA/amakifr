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
  createdAt: Date | string;
  updatedAt: Date | string;
  Justificatifs: JustificatifNoteFraisPublicDto[];
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
  createdAt: Date;
  updatedAt: Date;
  Justificatifs?: JustificatifRow[];
  Demandeur?: { id: string; email: string | null; name: string | null };
  Adherent?: { id: string; firstname: string; lastname: string };
};

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
 * Mappe une note vers un DTO public (sans chemins fichier).
 */
export function toNoteFraisPublicDto(note: NoteRow): NoteFraisPublicDto {
  return {
    id: note.id,
    libelle: note.libelle,
    description: note.description,
    dateDepense: note.dateDepense,
    montantDemande:
      typeof note.montantDemande === "object" && note.montantDemande !== null
        ? note.montantDemande.toString()
        : note.montantDemande,
    statut: note.statut,
    version: note.version,
    soumiseAt: note.soumiseAt,
    alerteSansDestinataire: note.alerteSansDestinataire,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    Justificatifs: (note.Justificatifs ?? []).map(toJustificatifPublicDto),
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
    montantDemande:
      typeof row.montantDemande === "object" && row.montantDemande !== null
        ? row.montantDemande.toString()
        : row.montantDemande,
    soumiseAt: row.soumiseAt,
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
