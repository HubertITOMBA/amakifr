/**
 * Adaptateur email Lot 3 — classification Accepted / DefinitelyNotAccepted / Unknown.
 *
 * Module **serveur dédié**, **non branché** aux actions / UI / cron.
 * Ne pas réutiliser le booléen de `sendEmail` / `EmailProviderInterface.send`.
 * Aucun retry automatique ; aucune promesse exactly-once fournisseur.
 *
 * Import explicite uniquement :
 * `@/lib/services/cotisations/rappel-dette/rappel-dette-email-provider-adapter`
 */

import {
  isValidRappelDetteTechnicalCode,
  type RappelDetteEmailOutcome,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-outcome";

export type { RappelDetteEmailOutcome };

/** Destinataire unique Lot 3. */
export type RappelDetteEmailSendRequest = {
  from: string;
  to: string;
  subject: string;
  html: string;
  /** Corrélation logs bornée — pas de PII. */
  correlationId?: string;
};

/**
 * Info Nodemailer pertinente (destinataire unique).
 * Transport injectable — aucun réseau réel dans les tests.
 */
export type SmtpSentMessageInfo = {
  accepted?: Array<string | { address?: string }>;
  rejected?: Array<string | { address?: string }>;
  pending?: Array<string | { address?: string }>;
  messageId?: string;
  response?: string;
};

export type SmtpTransport = {
  sendMail: (mail: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }) => Promise<SmtpSentMessageInfo>;
};

/**
 * Réponse Resend discriminable (SDK CreateEmailResponse élargi pour contradictions).
 */
export type ResendCreateEmailResponse = {
  data?: { id?: string } | null;
  error?: { message?: string; name?: string } | null;
};

export type ResendTransport = {
  emails: {
    send: (mail: {
      from: string;
      to: string[];
      subject: string;
      html: string;
    }) => Promise<ResendCreateEmailResponse>;
  };
};

const RESEND_DNA_NAMES = new Set([
  "missing_api_key",
  "invalid_api_key",
  "invalid_api_Key",
  "invalid_from_address",
  "missing_required_field",
  "invalid_parameter",
  "validation_error",
  "invalid_access",
]);

/**
 * Normalise une adresse pour comparaison (trim + minuscules).
 *
 * @param value - Adresse brute
 */
export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function addressListContains(
  list: Array<string | { address?: string }> | undefined,
  expected: string
): boolean {
  if (!list || list.length === 0) return false;
  const target = normalizeEmailAddress(expected);
  return list.some((entry) => {
    if (typeof entry === "string") {
      return normalizeEmailAddress(entry) === target;
    }
    if (entry && typeof entry.address === "string") {
      return normalizeEmailAddress(entry.address) === target;
    }
    return false;
  });
}

function unknown(code: string): RappelDetteEmailOutcome {
  const technicalCode = isValidRappelDetteTechnicalCode(code)
    ? code
    : "PROVIDER_AMBIGUOUS";
  return { kind: "Unknown", technicalCode };
}

function dna(code: string): RappelDetteEmailOutcome {
  const technicalCode = isValidRappelDetteTechnicalCode(code)
    ? code
    : "PROVIDER_REJECTED";
  return { kind: "DefinitelyNotAccepted", technicalCode };
}

/**
 * Classe une info SMTP (ou erreur) pour un destinataire unique attendu.
 * Contradictions / incomplet → Unknown. DNA seulement si rejet démontré.
 *
 * DefinitelyNotAccepted SMTP **uniquement** si :
 * - destinataire dans `rejected` (sans contradiction), ou
 * - `error.code` strictement `EAUTH` / `EENVELOPE`.
 *
 * Décision produit (cette passe) : un `responseCode: 535` (ou autre)
 * **sans** `error.code` reconnu → **Unknown** (`SMTP_TRANSPORT`),
 * pas DefinitelyNotAccepted. On n’élargit pas DNA aux seuls codes HTTP/SMTP
 * numériques ambigus.
 *
 * @param expectedTo - Destinataire unique attendu
 * @param info - Info Nodemailer éventuelle
 * @param error - Erreur throw éventuelle
 */
export function classifySmtpSendResult(
  expectedTo: string,
  info: SmtpSentMessageInfo | null | undefined,
  error?: unknown
): RappelDetteEmailOutcome {
  if (error != null) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
        ? String((error as { code: string }).code).toUpperCase()
        : "";
    if (code === "EAUTH") return dna("SMTP_AUTH");
    if (code === "EENVELOPE") return dna("SMTP_ENVELOPE");
    if (code === "ETIMEDOUT") return unknown("SMTP_TIMEOUT");
    if (code === "ESOCKET" || code === "ECONNECTION") {
      return unknown("SMTP_TRANSPORT");
    }
    // y compris responseCode:535 seul, sans code EAUTH
    return unknown("SMTP_TRANSPORT");
  }

  if (!info || typeof info !== "object") {
    return unknown("SMTP_INFO_INCOMPLETE");
  }

  const inAccepted = addressListContains(info.accepted, expectedTo);
  const inRejected = addressListContains(info.rejected, expectedTo);
  const inPending = addressListContains(info.pending, expectedTo);

  if (inAccepted && (inRejected || inPending)) {
    return unknown("SMTP_INFO_CONTRADICTION");
  }
  if (inRejected && inPending) {
    return unknown("SMTP_INFO_CONTRADICTION");
  }
  if (inRejected) return dna("SMTP_RCPT_REJECTED");
  if (inPending) return unknown("SMTP_RCPT_PENDING");
  if (inAccepted) return { kind: "Accepted" };
  return unknown("SMTP_INFO_INCOMPLETE");
}

/**
 * Classe une réponse Resend pour un destinataire unique.
 * Accepted uniquement si `data.id` présent et `error` null/absent.
 *
 * @param response - Réponse SDK (ou partielle)
 * @param error - Exception hors réponse
 */
export function classifyResendSendResult(
  response: ResendCreateEmailResponse | null | undefined,
  error?: unknown
): RappelDetteEmailOutcome {
  if (error != null) {
    return unknown("RESEND_EXCEPTION");
  }
  if (!response || typeof response !== "object") {
    return unknown("RESEND_RESPONSE_INCOMPLETE");
  }

  const hasError = response.error != null;
  const id =
    response.data &&
    typeof response.data === "object" &&
    typeof response.data.id === "string"
      ? response.data.id.trim()
      : "";
  const hasId = id.length > 0;

  if (hasId && hasError) {
    return unknown("RESEND_RESPONSE_CONTRADICTION");
  }
  if (hasId && !hasError) {
    return { kind: "Accepted" };
  }
  if (hasError) {
    const name =
      typeof response.error?.name === "string"
        ? response.error.name
        : "";
    if (RESEND_DNA_NAMES.has(name)) {
      if (name === "missing_api_key" || name === "invalid_api_key" || name === "invalid_api_Key") {
        return dna("RESEND_AUTH");
      }
      return dna("RESEND_VALIDATION");
    }
    if (name === "rate_limit_exceeded") return unknown("RESEND_RATE_LIMIT");
    if (
      name === "application_error" ||
      name === "internal_server_error"
    ) {
      return unknown("RESEND_SERVER");
    }
    if (name) return unknown("RESEND_UNRECOGNIZED");
    return unknown("RESEND_RESPONSE_INCOMPLETE");
  }
  return unknown("RESEND_RESPONSE_INCOMPLETE");
}

/**
 * Envoie via transport SMTP injectable puis classifie.
 * **Aucun** retry. Ne mappe **pas** un booléen false historique en DNA.
 *
 * @param transport - Transport injecté (mock en tests)
 * @param request - Message destinataire unique
 */
export async function sendRappelDetteEmailSmtp(
  transport: SmtpTransport,
  request: RappelDetteEmailSendRequest
): Promise<RappelDetteEmailOutcome> {
  const to = request.to.trim();
  if (!to) return unknown("SMTP_INFO_INCOMPLETE");
  try {
    const info = await transport.sendMail({
      from: request.from,
      to,
      subject: request.subject,
      html: request.html,
    });
    return classifySmtpSendResult(to, info);
  } catch (err) {
    return classifySmtpSendResult(to, null, err);
  }
}

/**
 * Envoie via transport Resend injectable puis classifie.
 *
 * @param transport - Client Resend injecté
 * @param request - Message destinataire unique
 */
export async function sendRappelDetteEmailResend(
  transport: ResendTransport,
  request: RappelDetteEmailSendRequest
): Promise<RappelDetteEmailOutcome> {
  const to = request.to.trim();
  if (!to) return unknown("RESEND_RESPONSE_INCOMPLETE");
  try {
    const response = await transport.emails.send({
      from: request.from,
      to: [to],
      subject: request.subject,
      html: request.html,
    });
    return classifyResendSendResult(response);
  } catch (err) {
    return classifyResendSendResult(null, err);
  }
}

/**
 * Ne convertit **jamais** un échec booléen opaque en DefinitelyNotAccepted.
 * Un wrapper historique `{ success: false }` sans preuve → Unknown.
 *
 * @param legacy - Résultat booléen type `EmailProviderInterface.send`
 */
export function classifyLegacyBooleanSendResult(legacy: {
  success: boolean;
  error?: unknown;
}): RappelDetteEmailOutcome {
  if (legacy.success === true) {
    // Preuve destinataire absente → pas Accepted optimiste
    return unknown("LEGACY_BOOLEAN_INSUFFICIENT");
  }
  return unknown("LEGACY_BOOLEAN_FAILURE");
}
