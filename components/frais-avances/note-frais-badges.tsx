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

/**
 * Badge statut note de frais.
 */
export function NoteFraisStatutBadge({ statut }: { statut: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-semibold", STATUT_CLASS[statut] || STATUT_CLASS.BROUILLON)}
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
      className={cn("text-xs font-semibold", MODE_CLASS[mode] || MODE_CLASS.REMBOURSEMENT)}
      data-testid="note-frais-mode-badge"
    >
      {mode}
    </Badge>
  );
}

/**
 * Badge montant (€).
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
