/**
 * Politiques de conservation notes de frais (lot 4.9).
 *
 * Trois politiques distinctes — allowlists réelles toujours vides.
 * Aucune durée produit par défaut ; aucune conservation détaillée indéfinie.
 * Injections réservées aux tests.
 */

export const NOTES_FRAIS_P1_FILES_RETENTION_ENV =
  "NOTES_FRAIS_P1_FILES_RETENTION";
export const NOTES_FRAIS_P2_ARCHIVE_PRIVEE_RETENTION_ENV =
  "NOTES_FRAIS_P2_ARCHIVE_PRIVEE_RETENTION";
export const NOTES_FRAIS_P3_JOURNAL_FINANCIER_RETENTION_ENV =
  "NOTES_FRAIS_P3_JOURNAL_FINANCIER_RETENTION";

/** @deprecated alias historique P2 — ne pas utiliser pour de nouvelles valeurs. */
export const NOTES_FRAIS_SUBMITTED_RETENTION_ENV =
  NOTES_FRAIS_P2_ARCHIVE_PRIVEE_RETENTION_ENV;

/** Valeurs acceptées une fois la décision métier livrée (listes vides). */
const VALIDATED_POLICIES_P1 = [] as const;
const VALIDATED_POLICIES_P2 = [] as const;
const VALIDATED_POLICIES_P3 = [] as const;

/** Alias historique. */
const VALIDATED_POLICIES = VALIDATED_POLICIES_P2;

export type NotesFraisSubmittedRetentionPolicy =
  (typeof VALIDATED_POLICIES)[number];

export type InjectedRetentionBase = {
  durationMs: number;
  startsAt: "archivedAt";
};

/**
 * Politique injectable P1 (fichiers/PJ) — tests uniquement.
 */
export type InjectedFilesRetentionPolicy = InjectedRetentionBase;

/**
 * Politique injectable P2 (archive privée) — tests uniquement.
 */
export type InjectedArchiveRetentionPolicy = InjectedRetentionBase;

/**
 * Politique injectable P3 (journal financier) — tests uniquement.
 * `resolvePeriodeCle` calcule la clé de période sans identité.
 */
export type InjectedJournalRetentionPolicy = InjectedRetentionBase & {
  resolvePeriodeCle: (occurredAt: Date) => string;
};

export type InjectedNotesFraisRetentionBundle = {
  p1?: InjectedFilesRetentionPolicy | null;
  p2?: InjectedArchiveRetentionPolicy | null;
  p3?: InjectedJournalRetentionPolicy | null;
};

export type RetentionPolicyResolution =
  | { status: "absent" }
  | { status: "unvalidated"; raw: string }
  | { status: "validated"; policy: string }
  | {
      status: "validated_injected";
      injected: InjectedRetentionBase;
      resolvePeriodeCle?: (occurredAt: Date) => string;
    };

export const ARCHIVE_REIDENTIFIABILITY_NOTICE =
  "date_montant_potentially_reidentifying" as const;

export const LIBELLE_DEPENSE_FRAIS_AVANCE_ARCHIVEE =
  "Charge de frais avancés archivée" as const;
export const DESCRIPTION_AVOIR_COMPENSATION_ARCHIVEE =
  "Compensation note de frais archivée" as const;
export const DESCRIPTION_UA_COMPENSATION_ARCHIVEE =
  "Utilisation compensation note de frais archivée" as const;

function resolveEnvPolicy(
  envKey: string,
  allowlist: readonly string[],
  env: NodeJS.ProcessEnv
): RetentionPolicyResolution {
  const raw = env[envKey]?.trim();
  if (!raw) return { status: "absent" };
  if (allowlist.includes(raw)) {
    return { status: "validated", policy: raw };
  }
  return { status: "unvalidated", raw };
}

/**
 * Résout P1 (fichiers/PJ) depuis l'env.
 */
export function resolveP1FilesRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env
): RetentionPolicyResolution {
  return resolveEnvPolicy(
    NOTES_FRAIS_P1_FILES_RETENTION_ENV,
    VALIDATED_POLICIES_P1,
    env
  );
}

/**
 * Résout P2 (archive privée) depuis l'env.
 * Accepte aussi la clé historique NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION.
 */
export function resolveP2ArchivePriveeRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env
): RetentionPolicyResolution {
  const primary = resolveEnvPolicy(
    NOTES_FRAIS_P2_ARCHIVE_PRIVEE_RETENTION_ENV,
    VALIDATED_POLICIES_P2,
    env
  );
  if (primary.status !== "absent") return primary;
  return resolveEnvPolicy(
    "NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION",
    VALIDATED_POLICIES_P2,
    env
  );
}

/**
 * Résout P3 (journal financier détaillé) depuis l'env.
 */
export function resolveP3JournalFinancierRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env
): RetentionPolicyResolution {
  return resolveEnvPolicy(
    NOTES_FRAIS_P3_JOURNAL_FINANCIER_RETENTION_ENV,
    VALIDATED_POLICIES_P3,
    env
  );
}

/**
 * @deprecated préférer resolveP2ArchivePriveeRetentionPolicy.
 */
export function resolveSubmittedJustificatifRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env
): RetentionPolicyResolution {
  return resolveP2ArchivePriveeRetentionPolicy(env);
}

/**
 * True uniquement si une politique env listée est validée (P2 historique).
 */
export function hasValidatedSubmittedRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return resolveP2ArchivePriveeRetentionPolicy(env).status === "validated";
}

function isUsable(resolution: RetentionPolicyResolution): boolean {
  if (resolution.status === "validated_injected") {
    return resolution.injected.durationMs > 0;
  }
  // Politiques env « validated » sans durée mappée : non utilisables.
  return false;
}

/**
 * Résolution effective d'une politique : injection test > env > absent.
 */
export function resolveEffectivePolicy(options: {
  injected?: InjectedRetentionBase | null;
  resolvePeriodeCle?: (occurredAt: Date) => string;
  envResolution: RetentionPolicyResolution;
}): RetentionPolicyResolution {
  if (options.injected && options.injected.durationMs > 0) {
    return {
      status: "validated_injected",
      injected: options.injected,
      resolvePeriodeCle: options.resolvePeriodeCle,
    };
  }
  return options.envResolution;
}

/**
 * Bundle effectif P1/P2/P3.
 * `injectedRetention` legacy (même durée pour les 3) + periodeCle année UTC.
 */
export function resolveEffectivePoliciesBundle(options?: {
  injected?: InjectedNotesFraisRetentionBundle | null;
  /** @deprecated shorthand tests : injecte P1=P2=P3 même durée. */
  injectedRetention?: InjectedArchiveRetentionPolicy | null;
  env?: NodeJS.ProcessEnv;
}): {
  p1: RetentionPolicyResolution;
  p2: RetentionPolicyResolution;
  p3: RetentionPolicyResolution;
} {
  const env = options?.env ?? process.env;
  const legacy = options?.injectedRetention;
  const bundle = options?.injected ?? {};

  const p1Injected = bundle.p1 ?? legacy ?? null;
  const p2Injected = bundle.p2 ?? legacy ?? null;
  const p3Injected = bundle.p3
    ? bundle.p3
    : legacy
      ? {
          ...legacy,
          resolvePeriodeCle: (d: Date) => String(d.getUTCFullYear()),
        }
      : null;

  return {
    p1: resolveEffectivePolicy({
      injected: p1Injected,
      envResolution: resolveP1FilesRetentionPolicy(env),
    }),
    p2: resolveEffectivePolicy({
      injected: p2Injected,
      envResolution: resolveP2ArchivePriveeRetentionPolicy(env),
    }),
    p3: resolveEffectivePolicy({
      injected: p3Injected
        ? {
            durationMs: p3Injected.durationMs,
            startsAt: p3Injected.startsAt,
          }
        : null,
      resolvePeriodeCle:
        p3Injected && "resolvePeriodeCle" in p3Injected
          ? p3Injected.resolvePeriodeCle
          : undefined,
      envResolution: resolveP3JournalFinancierRetentionPolicy(env),
    }),
  };
}

/**
 * @deprecated préférer resolveEffectivePoliciesBundle.
 */
export function resolveEffectiveArchiveRetention(options?: {
  injected?: InjectedArchiveRetentionPolicy | null;
  env?: NodeJS.ProcessEnv;
}): RetentionPolicyResolution {
  return resolveEffectivePoliciesBundle({
    injectedRetention: options?.injected,
    env: options?.env,
  }).p2;
}

/**
 * Calcule retentionEndsAt. Uniquement si politique effective injectée avec durée.
 */
export function computeRetentionEndsAt(
  archivedAt: Date,
  resolution: RetentionPolicyResolution
): Date | null {
  if (resolution.status === "validated_injected") {
    if (resolution.injected.startsAt !== "archivedAt") return null;
    return new Date(archivedAt.getTime() + resolution.injected.durationMs);
  }
  return null;
}

/**
 * True si la résolution permet un archivage / journal avec durée calculable.
 */
export function isRetentionUsable(
  resolution: RetentionPolicyResolution
): boolean {
  return isUsable(resolution);
}

/**
 * Champs structurés archive — pas de texte libre ni d'identifiant source.
 */
export type NoteFraisArchiveStructuredFields = {
  dateDepense: Date;
  montantDemande: string;
  soumiseAt: Date;
  statutFinal: string;
  montantAccepte: string | null;
  decideeAt: Date | null;
  archivedAt: Date;
  retentionEndsAt: Date;
  reidentifiabilityNotice: typeof ARCHIVE_REIDENTIFIABILITY_NOTICE;
};
