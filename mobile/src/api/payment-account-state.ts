/**
 * Helpers moyens de paiement / déclaration (purs).
 */

export type ActivePaymentAccountDto = {
  libelle: string;
  titulaire: string;
  iban: string;
  bic: string;
  codeBanque: string | null;
  codeGuichet: string | null;
  numeroCompte: string | null;
  cleRib: string | null;
  telephoneWero: string | null;
  weroActif: boolean;
};

export type PayableTargetType =
  | "cotisation-mensuelle"
  | "dette-initiale"
  | "assistance"
  | "obligation"
  | "inscription-evenement";

export const JUSTIFICATIF_MAX_BYTES = 10 * 1024 * 1024;

export const ALLOWED_JUSTIFICATIF_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export const NO_ACTIVE_PAYMENT_ACCOUNT_MESSAGE =
  "Aucun moyen de paiement n'est actuellement défini par l'association.";

export const WERO_PAYMENT_HINT =
  "Effectuez le paiement avec Wero ou avec l'application bancaire compatible avec Wero, puis revenez dans AMAKI pour déclarer votre paiement.";

export type PaymentCardActions = {
  /** Carte compacte « Paiement » (boutons d'action). */
  showPaymentCard: boolean;
  showWeroButton: boolean;
  showVirementButton: boolean;
  /** Bandeau si aucun compte actif. */
  warningMessage: string | null;
};

/**
 * Décide ce que la page principale affiche pour le paiement.
 * Les coordonnées bancaires détaillées ne sont jamais sur la page principale.
 */
export function getPaymentCardActions(
  account: ActivePaymentAccountDto | null | undefined
): PaymentCardActions {
  if (!account) {
    return {
      showPaymentCard: false,
      showWeroButton: false,
      showVirementButton: false,
      warningMessage: NO_ACTIVE_PAYMENT_ACCOUNT_MESSAGE,
    };
  }
  return {
    showPaymentCard: true,
    showWeroButton: isWeroAvailable(account),
    showVirementButton: true,
    warningMessage: null,
  };
}

/** La page principale ne doit jamais exposer IBAN/BIC/téléphone. */
export function mainScreenExposesBankDetails(): boolean {
  return false;
}

export function isWeroAvailable(
  account: ActivePaymentAccountDto | null | undefined
): boolean {
  return Boolean(account?.weroActif && account?.telephoneWero);
}

export function formatIbanDisplay(iban: string): string {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

export function paymentStatusLabel(statut: string): string {
  switch (statut) {
    case "EnAttente":
      return "En attente de validation";
    case "Valide":
      return "Validé";
    case "Annule":
      return "Rejeté";
    case "EnCours":
      return "En cours";
    default:
      return statut;
  }
}

export const PAYMENT_ALREADY_PENDING_MESSAGE =
  "Un paiement est déjà en attente de validation pour cette cotisation.";

type PendingPaymentLike = {
  statut: string;
  cotisationMensuelleId?: string | null;
  detteInitialeId?: string | null;
  assistanceId?: string | null;
  obligationCotisationId?: string | null;
  inscriptionEvenementId?: string | null;
};

/**
 * Indique si un EnAttente existe déjà pour la cible (UI — le serveur reste l'autorité).
 */
export function targetHasPendingPayment(
  payments: PendingPaymentLike[],
  targetType: PayableTargetType,
  targetId: string
): boolean {
  return payments.some((p) => {
    if (p.statut !== "EnAttente") return false;
    if (targetType === "cotisation-mensuelle") {
      return p.cotisationMensuelleId === targetId;
    }
    if (targetType === "dette-initiale") {
      return p.detteInitialeId === targetId;
    }
    if (targetType === "assistance") {
      return p.assistanceId === targetId;
    }
    if (targetType === "obligation") {
      return p.obligationCotisationId === targetId;
    }
    if (targetType === "inscription-evenement") {
      return p.inscriptionEvenementId === targetId;
    }
    return false;
  });
}

export type PayableLineTarget = {
  targetType: PayableTargetType;
  targetId: string;
  label: string;
  restant: string;
};

type YearSliceForPayable = {
  dettes: Array<{
    id: string;
    annee: number;
    montantRestant: string;
    hasPendingPayment?: boolean;
  }>;
  cotisations: Array<{
    id: string;
    mois: number;
    periode: string;
    montantRestant: string;
    typeCotisation: { nom: string };
    hasPendingPayment?: boolean;
  }>;
  assistances: Array<{
    id: string;
    montantRestant: string;
    displayLabel?: string | null;
    libelle?: string | null;
    description?: string | null;
    /** Déterminé serveur — ne jamais déduire du libellé. */
    paymentTargetType: PayableTargetType;
    hasPendingPayment?: boolean;
  }>;
  obligations?: Array<{
    id: string;
    annee: number;
    montantRestant: string;
    hasPendingPayment?: boolean;
  }>;
  /** @deprecated Préférer hasPendingPayment sur chaque ligne. */
  paiements?: PendingPaymentLike[];
};

function isZeroRestant(value: string): boolean {
  const n = Number(String(value).replace(",", "."));
  return !Number.isFinite(n) || Math.abs(n) < 0.005;
}

/**
 * Affiche le bouton Payer si reste > 0 et aucun EnAttente.
 */
export function canShowPayButton(
  montantRestant: string,
  hasPendingPayment: boolean
): boolean {
  return !isZeroRestant(montantRestant) && !hasPendingPayment;
}

const MOIS_SHORT = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

/**
 * Construit les cibles de paiement à partir de la vue annuelle.
 * Utilise `paymentTargetType` serveur pour les assistances (jamais le texte UI).
 */
export function buildPayableTargetsFromYear(
  yearData: YearSliceForPayable
): PayableLineTarget[] {
  const payments = yearData.paiements ?? [];
  const out: PayableLineTarget[] = [];

  for (const d of yearData.dettes) {
    if (isZeroRestant(d.montantRestant)) continue;
    if (
      d.hasPendingPayment ||
      targetHasPendingPayment(payments, "dette-initiale", d.id)
    ) {
      continue;
    }
    out.push({
      targetType: "dette-initiale",
      targetId: d.id,
      label: `Dette ${d.annee}`,
      restant: d.montantRestant,
    });
  }

  for (const c of yearData.cotisations) {
    if (isZeroRestant(c.montantRestant)) continue;
    if (
      c.hasPendingPayment ||
      targetHasPendingPayment(payments, "cotisation-mensuelle", c.id)
    ) {
      continue;
    }
    out.push({
      targetType: "cotisation-mensuelle",
      targetId: c.id,
      label: `${MOIS_SHORT[c.mois - 1] ?? c.periode} — ${c.typeCotisation.nom}`,
      restant: c.montantRestant,
    });
  }

  for (const a of yearData.assistances) {
    if (isZeroRestant(a.montantRestant)) continue;
    const targetType = a.paymentTargetType;
    if (
      a.hasPendingPayment ||
      targetHasPendingPayment(payments, targetType, a.id)
    ) {
      continue;
    }
    const label =
      (a.displayLabel && a.displayLabel.trim()) ||
      (a.libelle && a.libelle.trim()) ||
      (a.description && a.description.trim()) ||
      "Assistance";
    out.push({
      targetType,
      targetId: a.id,
      label,
      restant: a.montantRestant,
    });
  }

  for (const o of yearData.obligations ?? []) {
    if (isZeroRestant(o.montantRestant)) continue;
    if (
      o.hasPendingPayment ||
      targetHasPendingPayment(payments, "obligation", o.id)
    ) {
      continue;
    }
    out.push({
      targetType: "obligation",
      targetId: o.id,
      label: `Obligation ${o.annee}`,
      restant: o.montantRestant,
    });
  }

  return out;
}

/**
 * Message d'erreur déclaration (codes API).
 */
export function declarePaymentErrorMessage(error: {
  code?: string;
  message?: string;
  status?: number;
}): string {
  if (
    error.code === "PAYMENT_ALREADY_PENDING" ||
    (error.status === 409 &&
      (error.message || "").toLowerCase().includes("attente"))
  ) {
    return error.message?.trim() || PAYMENT_ALREADY_PENDING_MESSAGE;
  }
  if (error.message?.trim()) return error.message.trim();
  return "Impossible d'enregistrer le paiement";
}

/**
 * Contenu modal Wero (coords uniquement après clic).
 */
export function buildWeroModalContent(
  account: ActivePaymentAccountDto,
  reference: string,
  amount: string
): {
  phone: string;
  reference: string;
  amount: string;
  hint: string;
} | null {
  if (!isWeroAvailable(account) || !account.telephoneWero) return null;
  return {
    phone: account.telephoneWero,
    reference,
    amount,
    hint: WERO_PAYMENT_HINT,
  };
}

/**
 * Contenu modal virement (coords uniquement après clic).
 */
export function buildVirementModalContent(
  account: ActivePaymentAccountDto,
  reference: string,
  amount: string
): {
  titulaire: string;
  iban: string;
  bic: string;
  reference: string;
  amount: string;
} {
  return {
    titulaire: account.titulaire,
    iban: account.iban,
    bic: account.bic,
    reference,
    amount,
  };
}

/**
 * Référence conseillée côté client (indicatif).
 * Le serveur génère la référence définitive à la déclaration.
 */
export function buildClientPaymentReference(
  targetType: PayableTargetType,
  year: number = new Date().getFullYear()
): string {
  const typeCode =
    targetType === "cotisation-mensuelle"
      ? "COT"
      : targetType === "dette-initiale"
        ? "DET"
        : targetType === "assistance"
          ? "ASS"
          : targetType === "inscription-evenement"
            ? "EVT"
            : "OBL";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `AMAKI-${year}-${typeCode}-${rand}${ts}`;
}

export function buildSharePaymentCoords(
  account: ActivePaymentAccountDto,
  reference?: string
): string {
  const lines = [
    `Titulaire : ${account.titulaire}`,
    `IBAN : ${account.iban}`,
    `BIC : ${account.bic}`,
  ];
  if (isWeroAvailable(account) && account.telephoneWero) {
    lines.push(`Wero : ${account.telephoneWero}`);
  }
  if (reference) lines.push(`Référence : ${reference}`);
  return lines.join("\n");
}

export const DECLARE_OVERPAYMENT_HINT =
  "Si le montant dépasse le reste à payer, l'excédent sera affecté à vos dettes antérieures ou conservé en avoir.";

/**
 * Valide le montant déclaré (Wero/Virement).
 * Surpaiement autorisé : amount > restant est OK (ventilation à la validation admin).
 * Refusé uniquement : 0, négatif, non numérique.
 */
export function canDeclarePartialAmount(
  amountRaw: string,
  _restantRaw?: string
): { ok: boolean; error?: string } {
  const amount = Number(String(amountRaw).replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Montant invalide" };
  }
  return { ok: true };
}

/**
 * Indique si le montant saisi dépasse le restant (info UX non bloquante).
 */
export function isDeclaredAmountOverRestant(
  amountRaw: string,
  restantRaw: string
): boolean {
  const amount = Number(String(amountRaw).replace(",", "."));
  const restant = Number(String(restantRaw).replace(",", "."));
  if (!Number.isFinite(amount) || !Number.isFinite(restant)) return false;
  return amount > restant && restant >= 0;
}

export type JustificatifSelection = {
  uri: string;
  name: string;
  mime: string;
  size: number | null;
};

/**
 * Contrôle client du justificatif (le serveur reste l'autorité finale).
 */
export function validateJustificatifSelection(
  file: JustificatifSelection | null
): { ok: true } | { ok: false; error: string } {
  if (!file) {
    return { ok: false, error: "Joignez un justificatif (PDF ou image)" };
  }
  const mime = (file.mime || "").toLowerCase();
  const name = file.name.toLowerCase();
  const byExt =
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".gif") ||
    name.endsWith(".webp");
  if (!ALLOWED_JUSTIFICATIF_MIMES.has(mime) && !byExt) {
    return {
      ok: false,
      error: "Format non autorisé (PDF ou image uniquement)",
    };
  }
  if (file.size != null && file.size > JUSTIFICATIF_MAX_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (max 10 Mo)" };
  }
  return { ok: true };
}

export function guessMimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
