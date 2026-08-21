import { z } from "zod";

/** DTO admin complet (pas de secrets API). */
export type ComptePaiementAssociationDto = {
  id: string;
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
  actifPourPaiement: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Masque un IBAN pour affichage liste admin (garde début/fin).
 * Ex. FR14••••••••••••••••606
 */
export function maskIban(iban: string): string {
  const compact = String(iban ?? "").replace(/\s+/g, "").toUpperCase();
  if (compact.length < 8) return "••••";
  const start = compact.slice(0, 4);
  const end = compact.slice(-3);
  return `${start}${"•".repeat(Math.max(4, compact.length - 7))}${end}`;
}

/** DTO self-service : compte actif uniquement. */
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

const FIELD_LABELS: Record<string, string> = {
  libelle: "Libellé",
  titulaire: "Titulaire",
  iban: "IBAN",
  bic: "BIC",
  codeBanque: "Code banque",
  codeGuichet: "Code guichet",
  numeroCompte: "N° compte",
  cleRib: "Clé RIB",
  telephoneWero: "Téléphone Wero",
  weroActif: "Wero actif",
  actifPourPaiement: "Compte actif",
  id: "Identifiant",
};

/**
 * Message d'erreur Zod lisible avec le libellé du champ.
 */
export function formatComptePaiementZodError(error: z.ZodError): string {
  const issue = error.errors[0];
  if (!issue) return "Données invalides";
  const key = String(issue.path[0] ?? "");
  const label = FIELD_LABELS[key];
  const msg = issue.message;
  if (label) return `${label} : ${msg}`;
  return msg;
}

const optionalTrimmed = (max: number, label: string) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return null;
    return String(val).trim();
  }, z.string().max(max, `${label} : ${max} caractères maximum`).nullable());

/**
 * Normalise un numéro FR vers format international compact (+33…).
 */
export function normalizePhoneFr(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\D/g, "")}`;
  }
  const only = digits.replace(/\D/g, "");
  if (only.startsWith("33") && only.length >= 11) {
    return `+${only}`;
  }
  if (only.startsWith("0") && only.length === 10) {
    return `+33${only.slice(1)}`;
  }
  return only.startsWith("+") ? only : `+${only}`;
}

const ibanSchema = z
  .string({ required_error: "IBAN obligatoire" })
  .trim()
  .transform((s) => s.replace(/\s+/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .min(15, "IBAN trop court")
      .max(34, "IBAN trop long (34 caractères max)")
      .refine(
        (s) => /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(s),
        "IBAN invalide (ex. FR76…)"
      )
  );

/** BIC SWIFT : 8 ou 11 caractères, espaces ignorés avant contrôle. */
const bicSchema = z
  .string({ required_error: "BIC obligatoire" })
  .trim()
  .transform((s) => s.replace(/\s+/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .min(8, "trop court (8 ou 11 caractères, ex. PSSTFRPP)")
      .max(11, "trop long (8 ou 11 caractères, ex. PSSTFRPPXXX)")
      .refine(
        (s) => /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(s),
        "invalide (8 ou 11 caractères)"
      )
  );

export const CreateComptePaiementSchema = z
  .object({
    libelle: z
      .string()
      .trim()
      .min(1, "Libellé obligatoire")
      .max(120, "Libellé : 120 caractères maximum"),
    titulaire: z
      .string()
      .trim()
      .min(1, "Titulaire obligatoire")
      .max(200, "Titulaire : 200 caractères maximum"),
    iban: ibanSchema,
    bic: bicSchema,
    codeBanque: optionalTrimmed(5, "Code banque"),
    codeGuichet: optionalTrimmed(5, "Code guichet"),
    numeroCompte: optionalTrimmed(14, "N° compte"),
    cleRib: optionalTrimmed(2, "Clé RIB"),
    telephoneWero: z.preprocess((val) => {
      if (val === undefined || val === null || val === "") return null;
      return normalizePhoneFr(String(val).trim());
    }, z.string().max(20, "Téléphone Wero trop long").nullable()),
    weroActif: z.boolean().default(false),
    actifPourPaiement: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.weroActif && !data.telephoneWero) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le téléphone Wero est obligatoire si Wero est activé",
        path: ["telephoneWero"],
      });
    }
  });

export const UpdateComptePaiementSchema = z.object({
  id: z.string().min(1),
  libelle: z
    .string()
    .trim()
    .min(1, "Libellé obligatoire")
    .max(120, "Libellé : 120 caractères maximum")
    .optional(),
  titulaire: z
    .string()
    .trim()
    .min(1, "Titulaire obligatoire")
    .max(200, "Titulaire : 200 caractères maximum")
    .optional(),
  iban: ibanSchema.optional(),
  bic: bicSchema.optional(),
  codeBanque: optionalTrimmed(5, "Code banque").optional(),
  codeGuichet: optionalTrimmed(5, "Code guichet").optional(),
  numeroCompte: optionalTrimmed(14, "N° compte").optional(),
  cleRib: optionalTrimmed(2, "Clé RIB").optional(),
  telephoneWero: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (val === null || val === "") return null;
      return normalizePhoneFr(String(val).trim());
    }, z.string().max(20, "Téléphone Wero trop long").nullable().optional()),
  weroActif: z.boolean().optional(),
  actifPourPaiement: z.boolean().optional(),
});
