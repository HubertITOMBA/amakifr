/**
 * Politique de conservation des notes SOUMISES / archive privée.
 *
 * Aucune durée réelle validée métier à ce stade.
 * Aucune conservation indéfinie implicite.
 * Point de départ et durée : à valider par le trésorier.
 */

export const NOTES_FRAIS_SUBMITTED_RETENTION_ENV =
  "NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION";

/** Valeurs acceptées une fois la décision métier livrée (liste vide pour l'instant). */
const VALIDATED_POLICIES = [] as const;

export type NotesFraisSubmittedRetentionPolicy =
  (typeof VALIDATED_POLICIES)[number];

/**
 * Politique injectable (tests uniquement) — pas une durée produit.
 * startsAt = archivedAt uniquement tant que le trésorier n'a pas tranché.
 */
export type InjectedArchiveRetentionPolicy = {
  durationMs: number;
  startsAt: "archivedAt";
};

export type RetentionPolicyResolution =
  | { status: "absent" }
  | { status: "unvalidated"; raw: string }
  | { status: "validated"; policy: NotesFraisSubmittedRetentionPolicy }
  | {
      status: "validated_injected";
      injected: InjectedArchiveRetentionPolicy;
    };

export const ARCHIVE_REIDENTIFIABILITY_NOTICE =
  "date_montant_potentially_reidentifying" as const;

/**
 * Résout la politique explicite depuis l'env.
 * Toute valeur d'env non listée = non validée (pas de défaut).
 */
export function resolveSubmittedJustificatifRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env
): RetentionPolicyResolution {
  const raw = env[NOTES_FRAIS_SUBMITTED_RETENTION_ENV]?.trim();
  if (!raw) return { status: "absent" };
  if ((VALIDATED_POLICIES as readonly string[]).includes(raw)) {
    return {
      status: "validated",
      policy: raw as NotesFraisSubmittedRetentionPolicy,
    };
  }
  return { status: "unvalidated", raw };
}

/**
 * True uniquement si une politique env listée est validée.
 * L'injection test ne passe PAS par cette fonction (voir resolveEffective…).
 */
export function hasValidatedSubmittedRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return resolveSubmittedJustificatifRetentionPolicy(env).status === "validated";
}

/**
 * Résolution effective : injection test > politique env validée > absent/unvalidated.
 * En prod sans liste validée : toujours non validée → refus SOUMISE.
 */
export function resolveEffectiveArchiveRetention(options?: {
  injected?: InjectedArchiveRetentionPolicy | null;
  env?: NodeJS.ProcessEnv;
}): RetentionPolicyResolution {
  if (options?.injected && options.injected.durationMs > 0) {
    return { status: "validated_injected", injected: options.injected };
  }
  return resolveSubmittedJustificatifRetentionPolicy(options?.env ?? process.env);
}

/**
 * Calcule retentionEndsAt. Uniquement si politique effective validée/injectée.
 */
export function computeRetentionEndsAt(
  archivedAt: Date,
  resolution: RetentionPolicyResolution
): Date | null {
  if (resolution.status === "validated_injected") {
    if (resolution.injected.startsAt !== "archivedAt") return null;
    return new Date(archivedAt.getTime() + resolution.injected.durationMs);
  }
  // Politiques env validées : aucune durée mappée tant que le trésorier n'a pas décidé.
  return null;
}

/**
 * Champs structurés archive — pas de texte libre ni d'identifiant source.
 */
export type NoteFraisArchiveStructuredFields = {
  dateDepense: Date;
  montantDemande: string;
  soumiseAt: Date;
  archivedAt: Date;
  retentionEndsAt: Date;
  reidentifiabilityNotice: typeof ARCHIVE_REIDENTIFIABILITY_NOTICE;
};
