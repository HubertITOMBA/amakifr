import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUT_CLASS: Record<string, string> = {
  BROUILLON:
    "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-100",
  SOUMISE:
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100",
  VALIDEE:
    "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100",
  REJETEE:
    "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/40 dark:text-red-100",
};

const MODE_CLASS: Record<string, string> = {
  REMBOURSEMENT:
    "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/40 dark:text-blue-100",
  COMPENSATION:
    "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-900/40 dark:text-violet-100",
  MIXTE:
    "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-100",
};

const ETAT_FINANCIER_CLASS: Record<string, string> = {
  NON_REGLEE:
    "bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950/40 dark:text-orange-100",
  PARTIELLEMENT_REGLEE:
    "bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950/40 dark:text-sky-100",
  REGLEE:
    "bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/40 dark:text-teal-100",
};

const ETAT_FINANCIER_LABEL: Record<string, string> = {
  NON_REGLEE: "Non réglée",
  PARTIELLEMENT_REGLEE: "Partiellement réglée",
  REGLEE: "Réglée",
};

/**
 * Badge statut note de frais (administratif).
 */
export function NoteFraisStatutBadge({ statut }: { statut: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-semibold",
        STATUT_CLASS[statut] || STATUT_CLASS.BROUILLON
      )}
      data-testid="note-frais-statut-badge"
    >
      {statut}
    </Badge>
  );
}

/**
 * Badge mode de règlement.
 */
export function NoteFraisModeBadge({ mode }: { mode: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-semibold",
        MODE_CLASS[mode] || MODE_CLASS.REMBOURSEMENT
      )}
      data-testid="note-frais-mode-badge"
    >
      {mode}
    </Badge>
  );
}

/**
 * Badge état financier (distinct du statut administratif).
 */
export function NoteFraisEtatFinancierBadge({ etat }: { etat: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-semibold",
        ETAT_FINANCIER_CLASS[etat] || ETAT_FINANCIER_CLASS.NON_REGLEE
      )}
      data-testid="note-frais-etat-financier-badge"
    >
      {ETAT_FINANCIER_LABEL[etat] || etat}
    </Badge>
  );
}

/**
 * Badge montant (€) — value déjà formatée (chaîne).
 */
export function NoteFraisMontantBadge({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Badge
      variant="secondary"
      className="bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100 text-xs font-medium"
      data-testid="note-frais-montant-badge"
    >
      {label}&nbsp;: {String(value)}&nbsp;€
    </Badge>
  );
}

/**
 * Message toast métier sans données sensibles (référence, etc.).
 */
export function messageErreurNoteFrais(
  code?: string,
  fallback?: string
): string {
  switch (code) {
    case "REFRESH_REQUIRED":
      return "Données obsolètes — actualisez les cibles ou la note, puis réessayez.";
    case "VERSION_CONFLICT":
      return "Conflit de version — rechargez la note et réessayez.";
    case "IDEMPOTENCY_CONFLICT":
      return "Cette opération a déjà été enregistrée avec un contenu différent.";
    case "NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE":
      return "Opération mixte incomplète — contactez un administrateur.";
    case "CORRECTION_NO_CHANGE":
      return "Aucune modification effective de la référence.";
    case "CIBLE_MOUVEMENTS_POSTERIEURS":
      return "Mouvements postérieurs sur une cible — actualisez et réessayez.";
    case "PLAFOND_DEPASSE":
      return "Montant supérieur au net restant corrigeable.";
    case "AUTO_CORRECTION_FORBIDDEN":
      return "Auto-correction interdite.";
    case "AUTO_RESTITUTION_FORBIDDEN":
      return "Auto-restitution interdite.";
    case "RESTITUTION_EXCEEDS_REMAINING":
      return "Montant supérieur au reste restituable.";
    case "REGLEMENT_HAS_CORRECTIONS":
      return "Annulation impossible : des corrections existent déjà.";
    case "REGLEMENT_HAS_RESTITUTIONS":
      return "Annulation impossible : des restitutions existent déjà.";
    case "MIXTE_PARENT_REQUIRED":
      return "Pour un MIXTE, annulez l'opération parente (pas un enfant).";
    case "ANNULATION_EXPIRED":
      return "Cette demande d'annulation a expiré.";
    case "ANNULATION_ALREADY_DECIDED":
      return "Cette demande a déjà été tranchée.";
    case "ANNULATION_ALREADY_PENDING":
    case "ANNULATION_DEMANDE_ACTIVE":
      return "Une demande d'annulation est déjà en cours sur cette cible.";
    case "ANNULATION_ATTESTATION_REQUIRED":
      return "Attestation obligatoire pour confirmer l'annulation.";
    case "NOTES_FRAIS_FINANCIAL_HISTORY_ARCHIVE_REQUIRED":
    case "NOTES_FRAIS_P1_RETENTION_REQUIRED":
    case "NOTES_FRAIS_P2_RETENTION_REQUIRED":
    case "NOTES_FRAIS_P3_RETENTION_REQUIRED":
    case "NOTES_FRAIS_DETACH_COUNT_MISMATCH":
    case "NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT":
      return "Suppression impossible : politique de conservation manquante ou état financier incohérent.";
    case "FORBIDDEN":
      return "Action non autorisée.";
    case "NOTES_FRAIS_DISABLED":
      return "Le module frais avancés n'est pas activé.";
    default:
      return fallback || "Erreur lors de l'opération.";
  }
}
