import type { Sondage, SondageQuestionType, SondageStatus } from "@prisma/client";

export type SondageQuestionInput = {
  ordre: number;
  section?: string | null;
  libelle: string;
  type: SondageQuestionType;
  obligatoire?: boolean;
  maxSelections?: number | null;
  minCaracteres?: number | null;
  maxCaracteres?: number | null;
  options?: Array<{
    ordre: number;
    libelle: string;
    permetTexteLibre?: boolean;
  }>;
  lignesMatrice?: Array<{
    ordre: number;
    libelle: string;
  }>;
};

export type SondageReponseItemInput = {
  questionId: string;
  optionId?: string | null;
  ligneMatriceId?: string | null;
  texteLibre?: string | null;
};

/**
 * Indique si un sondage accepte encore des réponses ou modifications.
 */
export function isSondageModifiable(
  sondage: Pick<Sondage, "status" | "dateDebut" | "dateFin">,
  now = new Date()
): boolean {
  if (sondage.status !== "Ouvert") return false;
  return sondage.dateDebut <= now && now <= sondage.dateFin;
}

/**
 * Indique si un sondage est visible pour les adhérents (lien profil).
 */
export function isSondageVisiblePourAdherent(
  sondage: Pick<Sondage, "status" | "dateDebut" | "dateFin">,
  now = new Date()
): boolean {
  if (sondage.status !== "Ouvert") return false;
  return sondage.dateDebut <= now && now <= sondage.dateFin;
}

/**
 * Calcule le statut effectif en tenant compte des dates (sans modifier la base).
 */
export function getSondageStatutEffectif(
  sondage: Pick<Sondage, "status" | "dateDebut" | "dateFin">,
  now = new Date()
): SondageStatus {
  if (sondage.status === "Cloture") return "Cloture";
  if (sondage.status === "Brouillon") return "Brouillon";
  if (now > sondage.dateFin) return "Cloture";
  return "Ouvert";
}

/**
 * Valide la cohérence des dates d'un sondage.
 */
export function validateSondageDates(dateDebut: Date, dateFin: Date): string | null {
  if (dateFin <= dateDebut) {
    return "La date de fin doit être postérieure à la date de début";
  }
  return null;
}
