/**
 * Constantes du parcours « mot de passe oublié » (challenge code 8 chiffres).
 * Distinct de VerificationToken (inscription).
 *
 * Rate-limit : PostgreSQL (PasswordResetRateLimit), pas Redis.
 *
 * Seuils retenus (fenêtre 15 min) :
 * - IP 30 : large pour NAT familial / mobile, freine le spray
 * - EMAIL 10 : au-delà du cooldown 60 s, limite le harcèlement par boîte
 * - COMBINATION 8 : couple IP+email — plus strict que l’email seul
 * Justification : assez permissif pour un usage légitime (retries, typos),
 * assez bas pour freiner énumération / bruteforce de codes sans job Redis.
 */

/** Séparation de domaine HMAC pour les codes. */
export const PASSWORD_RESET_HMAC_DOMAIN = "amaki:v1:password-reset-code:";

/** Séparation de domaine HMAC pour les clés de rate-limit (jamais email/IP bruts). */
export const PASSWORD_RESET_RL_HMAC_DOMAIN = "amaki:v1:password-reset-rl:";

/**
 * Opérations rate-limit distinctes (domaines HMAC séparés).
 * Une demande ne consomme pas le quota de confirmation et inversement.
 */
export const PASSWORD_RESET_RL_OP_REQUEST = "PASSWORD_RESET_REQUEST" as const;
export const PASSWORD_RESET_RL_OP_CONFIRM = "PASSWORD_RESET_CONFIRM" as const;

export type PasswordResetRateLimitOperation =
  | typeof PASSWORD_RESET_RL_OP_REQUEST
  | typeof PASSWORD_RESET_RL_OP_CONFIRM;

/** TTL du challenge (ms) — 10 minutes. */
export const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;

/** Cooldown serveur entre deux demandes (ms) — 60 secondes (métier, par email). */
export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

/** Nombre max d'échecs de code avant verrouillage. */
export const PASSWORD_RESET_MAX_FAILED_ATTEMPTS = 5;

/** Longueur du code numérique. */
export const PASSWORD_RESET_CODE_DIGITS = 8;

/** Reprises bornées sur conflits Prisma (P2034 / P2002). */
export const PASSWORD_RESET_TX_MAX_ATTEMPTS = 3;

/**
 * Longueur minimale du nouveau mot de passe (alignement projet historique).
 * Trop faible — à renforcer dans un lot dédié.
 */
export const PASSWORD_RESET_PASSWORD_MIN_LENGTH = 6;

/** Longueur min du secret HMAC (octets UTF-8). */
export const PASSWORD_RESET_HMAC_SECRET_MIN_BYTES = 32;

/** Rate-limit PG : par IP (fenêtre 15 min). */
export const PASSWORD_RESET_RL_IP_MAX = 30;
export const PASSWORD_RESET_RL_IP_WINDOW_MS = 15 * 60 * 1000;

/** Rate-limit PG : par email normalisé (fenêtre 15 min). */
export const PASSWORD_RESET_RL_EMAIL_MAX = 10;
export const PASSWORD_RESET_RL_EMAIL_WINDOW_MS = 15 * 60 * 1000;

/** Rate-limit PG : combinaison IP + email. */
export const PASSWORD_RESET_RL_COMBO_MAX = 8;
export const PASSWORD_RESET_RL_COMBO_WINDOW_MS = 15 * 60 * 1000;

/** Nettoyage opportuniste borné des lignes rate-limit expirées. */
export const PASSWORD_RESET_RL_CLEANUP_BATCH = 50;
