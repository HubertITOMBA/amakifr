"use client";

import type { NoteFraisHistoriqueReglementDto } from "@/lib/frais-avances/dto";
import { NoteFraisModeBadge } from "@/components/frais-avances/note-frais-badges";

type Props = {
  entries: NoteFraisHistoriqueReglementDto[];
  /** Afficher la référence (capacité financière uniquement). */
  showReference?: boolean;
};

function formatDateFr(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

/**
 * Historique groupé des règlements (simples + mixte) — sans double total.
 */
export function NoteFraisHistoriqueReglements({
  entries,
  showReference = false,
}: Props) {
  if (!entries.length) {
    return (
      <p className="text-xs text-slate-600">Aucun règlement exécuté.</p>
    );
  }

  return (
    <ul className="space-y-2 text-xs" data-testid="note-frais-historique">
      {entries.map((e) => (
        <li
          key={`${e.kind}-${e.id}`}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-2 space-y-1"
        >
          <div className="flex flex-wrap items-center gap-2">
            {e.kind === "MIXTE" ? (
              <NoteFraisModeBadge mode="MIXTE" />
            ) : e.kind === "REMBOURSEMENT_SIMPLE" ? (
              <NoteFraisModeBadge mode="REMBOURSEMENT" />
            ) : e.kind === "COMPENSATION_SIMPLE" ? (
              <NoteFraisModeBadge mode="COMPENSATION" />
            ) : e.kind === "CORRECTION_REFERENCE" ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                Correction réf.
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                Correction montant
              </span>
            )}
            <span className="text-slate-600">{formatDateFr(e.executeAt)}</span>
            {e.executeurLabel ? (
              <span className="text-slate-500">par {e.executeurLabel}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-800">
            {e.montantRemboursement != null ? (
              <span>Remb. {e.montantRemboursement} €</span>
            ) : null}
            {e.montantCompensation != null ? (
              <span>Comp. {e.montantCompensation} €</span>
            ) : null}
            {e.montantCorrection != null ? (
              <span>Corr. {e.montantCorrection} €</span>
            ) : null}
            {e.moyen ? <span>Moyen : {e.moyen}</span> : null}
            {showReference && e.reference ? (
              <span className="font-mono">Réf. {e.reference}</span>
            ) : null}
            {e.referenceAvant && e.referenceApres ? (
              <span className="font-mono text-slate-600">
                {e.referenceAvant} → {e.referenceApres}
              </span>
            ) : null}
            {e.motif ? (
              <span className="text-slate-600">Motif : {e.motif}</span>
            ) : null}
            {e.preuveKind ? (
              <span className="text-slate-500">
                Preuve {e.preuveKind}
                {e.preuveRef ? ` (${e.preuveRef})` : ""}
              </span>
            ) : null}
          </div>
          {e.cibles?.length ? (
            <ul className="list-disc pl-4 text-slate-600">
              {e.cibles.map((c, i) => (
                <li key={`${c.typeCible}-${i}`}>
                  {c.libelle} — {c.montant} €
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
