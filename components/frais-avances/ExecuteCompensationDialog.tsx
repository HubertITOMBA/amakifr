"use client";

import { useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { actionExecuteNoteFraisCompensation } from "@/actions/frais-avances";
import {
  messageErreurNoteFrais,
  NoteFraisMontantBadge,
} from "@/components/frais-avances/note-frais-badges";
import {
  CompensationCiblesFields,
  buildCompensationLignesFromAllocations,
  type CompensationCibleOption,
} from "@/components/frais-avances/CompensationCiblesFields";
import {
  FRAIS_AVANCES_SECTION_BLUE_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type ExecuteCompensationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  expectedVersion: number;
  idempotencyKey: string;
  plafondRestant: string;
  cibles: CompensationCibleOption[];
  onDone: () => void | Promise<void>;
};

/**
 * Dialog minimal d'exécution d'une compensation (TRESOR/ADMIN).
 */
export function ExecuteCompensationDialog({
  open,
  onOpenChange,
  noteId,
  expectedVersion,
  idempotencyKey,
  plafondRestant,
  cibles,
  onDone,
}: ExecuteCompensationDialogProps) {
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setAllocations({});
  }, [open]);

  async function onConfirm() {
    const lignes = buildCompensationLignesFromAllocations(cibles, allocations);
    if (lignes.length === 0) {
      toast.error("Sélectionnez au moins une cible avec un montant");
      return;
    }
    setSubmitting(true);
    try {
      const res = await actionExecuteNoteFraisCompensation({
        noteId,
        expectedNoteVersion: expectedVersion,
        idempotencyKey,
        lignes,
      });
      if (!res.success) {
        toast.error(messageErreurNoteFrais(res.code, res.error));
        return;
      }
      toast.success(res.message || "Compensation enregistrée");
      onOpenChange(false);
      await onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Exécuter une compensation"
      description="Imputation sur dettes / cotisations du choix ACTIF. Aucun décaissement bancaire."
      icon={<Scale className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="execute-compensation-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm()}
            aria-busy={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
            ) : null}
            Confirmer la compensation
          </Button>
        </>
      }
    >
      <div className={FRAIS_AVANCES_SECTION_BLUE_CLASS}>
        <NoteFraisMontantBadge label="Plafond compensation" value={plafondRestant} />
      </div>
      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <CompensationCiblesFields
          cibles={cibles}
          allocations={allocations}
          onChange={setAllocations}
          disabled={submitting}
        />
      </div>
    </FraisAvancesDialogShell>
  );
}
