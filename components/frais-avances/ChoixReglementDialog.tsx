"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionSetChoixReglementNoteFrais } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  messageErreurNoteFrais,
  NoteFraisModeBadge,
  NoteFraisMontantBadge,
} from "@/components/frais-avances/note-frais-badges";
import {
  centsToMoneyString,
  moneyIsStrictlyPositive,
  moneySubStrings,
  parseMoneyToCents,
} from "@/lib/frais-avances/money-cents";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_BLUE_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type ModeChoix = "REMBOURSEMENT" | "COMPENSATION" | "MIXTE";

type CibleEligible = {
  typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
  cibleId: string;
  libelle: string;
  montantRestant: string;
};

type ChoixReglementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  /** Montant accepté en chaîne monétaire. */
  montantAccepte: string;
  cibles: CibleEligible[];
  initialMode?: ModeChoix;
  replacing?: boolean;
  onDone: () => void | Promise<void>;
  onRefreshRequired?: () => void | Promise<void>;
};

/**
 * Dialog de choix ou remplacement du mode de règlement.
 */
export function ChoixReglementDialog({
  open,
  onOpenChange,
  noteId,
  expectedNoteVersion,
  idempotencyKey,
  montantAccepte,
  cibles,
  initialMode = "REMBOURSEMENT",
  replacing = false,
  onDone,
  onRefreshRequired,
}: ChoixReglementDialogProps) {
  const [mode, setMode] = useState<ModeChoix>(initialMode);
  const [montantRemboursement, setMontantRemboursement] =
    useState(montantAccepte);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setMontantRemboursement(montantAccepte);
    setAllocations({});
  }, [open, initialMode, montantAccepte]);

  const selectedCibles = useMemo(() => {
    return cibles
      .map((c, idx) => {
        const key = `${c.typeCible}:${c.cibleId}`;
        const raw = allocations[key]?.trim() || "";
        if (!raw) return null;
        try {
          if (!moneyIsStrictlyPositive(raw)) return null;
          return {
            typeCible: c.typeCible,
            cibleId: c.cibleId,
            montantAutorise: centsToMoneyString(parseMoneyToCents(raw)),
            rang: idx,
            libelle: c.libelle,
          };
        } catch {
          return null;
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [allocations, cibles]);

  const sumCompensationCents = selectedCibles.reduce((s, c) => {
    try {
      return s + parseMoneyToCents(c.montantAutorise);
    } catch {
      return s;
    }
  }, 0);
  const sumCompensationStr = centsToMoneyString(sumCompensationCents);

  function syncModeDefaults(next: ModeChoix) {
    setMode(next);
    if (next === "REMBOURSEMENT") {
      setMontantRemboursement(montantAccepte);
      setAllocations({});
    } else if (next === "COMPENSATION") {
      setMontantRemboursement("0.00");
    } else {
      try {
        setMontantRemboursement(
          moneySubStrings(montantAccepte, sumCompensationStr)
        );
      } catch {
        setMontantRemboursement("0.00");
      }
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      let remb = "0.00";
      let comp = "0.00";
      if (mode === "REMBOURSEMENT") {
        remb = montantAccepte;
        comp = "0.00";
      } else if (mode === "COMPENSATION") {
        remb = "0.00";
        comp = sumCompensationStr;
      } else {
        try {
          remb = centsToMoneyString(
            parseMoneyToCents(montantRemboursement.trim() || "0")
          );
        } catch {
          toast.error("Montant remboursement invalide");
          return;
        }
        comp = sumCompensationStr;
      }

      const res = await actionSetChoixReglementNoteFrais({
        noteId,
        expectedNoteVersion,
        idempotencyKey,
        mode,
        montantRemboursement: remb,
        montantCompensation: mode === "REMBOURSEMENT" ? "0.00" : comp,
        cibles:
          mode === "REMBOURSEMENT"
            ? []
            : selectedCibles.map((c) => ({
                typeCible: c.typeCible,
                cibleId: c.cibleId,
                montantAutorise: c.montantAutorise,
                rang: c.rang,
              })),
      });
      if (!res.success) {
        toast.error(messageErreurNoteFrais(res.code, res.error));
        if (res.code === "REFRESH_REQUIRED") {
          await onRefreshRequired?.();
        }
        return;
      }
      toast.success(res.message || "Choix enregistré");
      onOpenChange(false);
      await onDone();
    } finally {
      setSaving(false);
    }
  }

  let totalMixteLabel = "";
  try {
    const rembC = parseMoneyToCents(montantRemboursement.trim() || "0");
    totalMixteLabel = centsToMoneyString(rembC + sumCompensationCents);
  } catch {
    totalMixteLabel = "—";
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={replacing ? "Remplacer le choix" : "Choix de règlement"}
      description="Indiquez comment utiliser le montant accepté."
      icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="choix-reglement-dialog"
      contentClassName="max-w-xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-sm h-8 sm:h-9 border-slate-300"
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm h-8 sm:h-9"
            data-testid="choix-reglement-submit"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer le choix"
            )}
          </Button>
        </>
      }
    >
      <section className={FRAIS_AVANCES_SECTION_BLUE_CLASS}>
        <div className="flex flex-wrap gap-2 items-center">
          <NoteFraisModeBadge mode={mode} />
          <NoteFraisMontantBadge label="Accepté" value={montantAccepte} />
        </div>
        <p className="text-xs text-slate-600">
          Aucun mouvement financier tant que le règlement n&apos;est pas exécuté.
        </p>
      </section>

      <section className={FRAIS_AVANCES_SECTION_CLASS}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Mode *
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Mode de règlement"
        >
          {(
            [
              ["REMBOURSEMENT", "Remboursement"],
              ["COMPENSATION", "Compensation"],
              ["MIXTE", "Mixte"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={mode === value ? "default" : "outline"}
              className="h-8 text-sm"
              onClick={() => syncModeDefaults(value)}
              data-testid={`choix-mode-${value.toLowerCase()}`}
            >
              {label}
            </Button>
          ))}
        </div>

        {mode === "MIXTE" ? (
          <div className="space-y-1">
            <Label htmlFor="nf-choix-remb" className={FRAIS_AVANCES_LABEL_CLASS}>
              Montant remboursement (€) *
            </Label>
            <Input
              id="nf-choix-remb"
              inputMode="decimal"
              value={montantRemboursement}
              onChange={(e) => setMontantRemboursement(e.target.value)}
              className={FRAIS_AVANCES_INPUT_CLASS}
            />
          </div>
        ) : null}

        {mode !== "REMBOURSEMENT" ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              Affectez les montants (somme = compensation).
            </p>
            {cibles.length === 0 ? (
              <p className="text-sm text-amber-800">
                Aucune cible éligible (dette / cotisation ordinaire).
              </p>
            ) : (
              cibles.map((c) => {
                const key = `${c.typeCible}:${c.cibleId}`;
                const fieldId = `nf-choix-alloc-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                return (
                  <div
                    key={key}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2 items-end rounded-md border border-slate-200 bg-white dark:bg-slate-950/40 p-2"
                  >
                    <div className="min-w-0">
                      <Label
                        htmlFor={fieldId}
                        className={FRAIS_AVANCES_LABEL_CLASS}
                      >
                        {c.libelle}
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Restant : {c.montantRestant} €
                      </p>
                    </div>
                    <Input
                      id={fieldId}
                      inputMode="decimal"
                      placeholder="0"
                      value={allocations[key] ?? ""}
                      onChange={(e) =>
                        setAllocations((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className={`${FRAIS_AVANCES_INPUT_CLASS} h-8`}
                    />
                  </div>
                );
              })
            )}
            <p className="text-xs text-slate-700">
              Compensation : {sumCompensationStr} €
              {mode === "MIXTE"
                ? ` · Remboursement : ${montantRemboursement || "0"} € · Total : ${totalMixteLabel} € / ${montantAccepte} €`
                : ` / ${montantAccepte} €`}
            </p>
          </div>
        ) : null}
      </section>
    </FraisAvancesDialogShell>
  );
}
