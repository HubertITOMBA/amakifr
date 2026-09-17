"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
} from "@/components/frais-avances/FraisAvancesDialogShell";

export type CompensationCibleOption = {
  typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
  cibleId: string;
  libelle: string;
  /** Restant utilisable (chaîne décimale). */
  plafondRestant: string;
};

type CompensationCiblesFieldsProps = {
  cibles: CompensationCibleOption[];
  /** Map clé `type:cibleId` → montant chaîne. */
  allocations: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
};

/**
 * Sélection explicite des cibles de compensation (montants en chaînes).
 */
export function CompensationCiblesFields({
  cibles,
  allocations,
  onChange,
  disabled,
}: CompensationCiblesFieldsProps) {
  if (cibles.length === 0) {
    return (
      <p className="text-xs text-slate-600" role="status">
        Aucune cible de compensation sur le choix ACTIF.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {cibles.map((c) => {
        const key = `${c.typeCible}:${c.cibleId}`;
        const id = `comp-cible-${c.cibleId}`;
        return (
          <li
            key={key}
            className="rounded-md border border-slate-200 bg-white p-2 space-y-1"
          >
            <Label htmlFor={id} className={FRAIS_AVANCES_LABEL_CLASS}>
              {c.libelle} — plafond {c.plafondRestant} €
            </Label>
            <Input
              id={id}
              inputMode="decimal"
              value={allocations[key] ?? ""}
              disabled={disabled}
              placeholder="0.00"
              onChange={(e) =>
                onChange({ ...allocations, [key]: e.target.value })
              }
              className={FRAIS_AVANCES_INPUT_CLASS}
              autoComplete="off"
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Construit les lignes compensation depuis les allocations (chaînes).
 * Ignore les montants vides ; ne convertit pas en Number.
 */
export function buildCompensationLignesFromAllocations(
  cibles: CompensationCibleOption[],
  allocations: Record<string, string>
): Array<{
  typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
  cibleId: string;
  montant: string;
  rang: number;
}> {
  const out: Array<{
    typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
    cibleId: string;
    montant: string;
    rang: number;
  }> = [];
  let rang = 1;
  for (const c of cibles) {
    const key = `${c.typeCible}:${c.cibleId}`;
    const raw = (allocations[key] ?? "").trim();
    if (!raw) continue;
    out.push({
      typeCible: c.typeCible,
      cibleId: c.cibleId,
      montant: raw,
      rang: rang++,
    });
  }
  return out;
}
