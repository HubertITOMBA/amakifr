"use client";

import { useEffect, useMemo, useState } from "react";
import { GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "react-toastify";
import { actionExecuteNoteFraisReglementMixte } from "@/actions/frais-avances";
import { NoteFraisMontantBadge } from "@/components/frais-avances/note-frais-badges";
import { datetimeLocalToIso } from "@/lib/frais-avances/datetime-local";
import { moneyIsStrictlyPositive } from "@/lib/frais-avances/money-cents";
import {
  CompensationCiblesFields,
  buildCompensationLignesFromAllocations,
  type CompensationCibleOption,
} from "@/components/frais-avances/CompensationCiblesFields";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_BLUE_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type ExecuteMixteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  expectedVersion: number;
  idempotencyKey: string;
  plafondRemboursement: string;
  plafondCompensation: string;
  cibles: CompensationCibleOption[];
  onDone: () => void | Promise<void>;
  onRedirectSimple?: (kind: "REMBOURSEMENT" | "COMPENSATION") => void;
};

/**
 * Dialog minimal d'exécution mixte atomique (compensation + remboursement).
 */
export function ExecuteMixteDialog({
  open,
  onOpenChange,
  noteId,
  expectedVersion,
  idempotencyKey,
  plafondRemboursement,
  plafondCompensation,
  cibles,
  onDone,
  onRedirectSimple,
}: ExecuteMixteDialogProps) {
  const [montantRemb, setMontantRemb] = useState(plafondRemboursement);
  const [moyen, setMoyen] = useState<"VIREMENT" | "ESPECES">("VIREMENT");
  const [reference, setReference] = useState("");
  const [executeLocal, setExecuteLocal] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const tzLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
    } catch {
      return "local";
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMontantRemb(plafondRemboursement);
      setMoyen("VIREMENT");
      setReference("");
      setAllocations({});
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setExecuteLocal(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
      );
    }
  }, [open, plafondRemboursement]);

  async function onConfirm() {
    const lignes = buildCompensationLignesFromAllocations(cibles, allocations);
    const rembTrim = montantRemb.trim();
    if (!moneyIsStrictlyPositive(rembTrim)) {
      toast.error(
        "Partie remboursement nulle — utilisez le dialog remboursement simple"
      );
      onRedirectSimple?.("REMBOURSEMENT");
      return;
    }
    if (lignes.length === 0) {
      toast.error(
        "Partie compensation nulle — utilisez le dialog compensation simple"
      );
      onRedirectSimple?.("COMPENSATION");
      return;
    }

    setSubmitting(true);
    try {
      let executeAt: string;
      try {
        executeAt = datetimeLocalToIso(executeLocal);
      } catch {
        toast.error("Date/heure d'exécution invalide");
        return;
      }
      const res = await actionExecuteNoteFraisReglementMixte({
        noteId,
        expectedNoteVersion: expectedVersion,
        idempotencyKey,
        montantRembourse: rembTrim,
        moyen,
        reference,
        executeAt,
        lignesCompensation: lignes,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message || "Règlement mixte enregistré");
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
      title="Exécuter un règlement mixte"
      description={`Compensation et remboursement atomiques (fuseau : ${tzLabel}). Une seule confirmation.`}
      icon={<GitMerge className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="execute-mixte-dialog"
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
            Confirmer le mixte
          </Button>
        </>
      }
    >
      <div className={FRAIS_AVANCES_SECTION_BLUE_CLASS}>
        <div className="flex flex-wrap gap-2">
          <NoteFraisMontantBadge
            label="Plafond remb."
            value={plafondRemboursement}
          />
          <NoteFraisMontantBadge
            label="Plafond comp."
            value={plafondCompensation}
          />
        </div>
      </div>

      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Remboursement
        </p>
        <div className="space-y-1">
          <Label htmlFor="mixte-montant-remb" className={FRAIS_AVANCES_LABEL_CLASS}>
            Montant (€)
          </Label>
          <Input
            id="mixte-montant-remb"
            inputMode="decimal"
            value={montantRemb}
            onChange={(e) => setMontantRemb(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            aria-required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mixte-moyen" className={FRAIS_AVANCES_LABEL_CLASS}>
            Moyen
          </Label>
          <Select
            value={moyen}
            onValueChange={(v) => setMoyen(v as "VIREMENT" | "ESPECES")}
          >
            <SelectTrigger id="mixte-moyen" className={FRAIS_AVANCES_INPUT_CLASS}>
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIREMENT">Virement</SelectItem>
              <SelectItem value="ESPECES">Espèces</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="mixte-ref" className={FRAIS_AVANCES_LABEL_CLASS}>
            {moyen === "ESPECES" ? "N° / référence de reçu" : "Référence bancaire"}
          </Label>
          <Input
            id="mixte-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            maxLength={64}
            autoComplete="off"
            aria-required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mixte-date" className={FRAIS_AVANCES_LABEL_CLASS}>
            Date et heure d&apos;exécution
          </Label>
          <Input
            id="mixte-date"
            type="datetime-local"
            value={executeLocal}
            onChange={(e) => setExecuteLocal(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            aria-required
            aria-describedby="mixte-date-help"
          />
          <p id="mixte-date-help" className="text-xs text-slate-500">
            Instant unique pour l&apos;opération et les deux règlements enfants.
          </p>
        </div>
      </div>

      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">
          Compensation
        </p>
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
