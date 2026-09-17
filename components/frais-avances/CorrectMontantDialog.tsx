"use client";

import { useEffect, useMemo, useState } from "react";
import { MinusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionCorrectNoteFraisReglement } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  messageErreurNoteFrais,
  NoteFraisMontantBadge,
} from "@/components/frais-avances/note-frais-badges";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";
import { parseMoneyToCents } from "@/lib/frais-avances/money-cents";

type LigneOption = {
  id: string;
  rang: number;
  typeCible: string;
  cibleId: string;
  montantRestaurable: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  reglementId: string;
  reglementType: "REMBOURSEMENT" | "COMPENSATION";
  expectedVersion: number;
  idempotencyKey: string;
  netRestant: string;
  lignes?: LigneOption[];
  onDone: () => void | Promise<void>;
};

const PREUVE_OPTIONS = [
  { value: "PV_TRESORERIE", label: "PV trésorerie" },
  { value: "JUSTIFICATIF_INTERNE", label: "Justificatif interne" },
  { value: "EMAIL_TRACE", label: "Trace email (id interne)" },
  { value: "AUTRE_TRACE", label: "Autre trace" },
] as const;

/**
 * Dialog correction MONTANT_NEGATIF — remboursement ou compensation multilignes.
 */
export function CorrectMontantDialog({
  open,
  onOpenChange,
  noteId,
  reglementId,
  reglementType,
  expectedVersion,
  idempotencyKey,
  netRestant,
  lignes = [],
  onDone,
}: Props) {
  const [montantACorriger, setMontantACorriger] = useState(netRestant);
  const [motif, setMotif] = useState("");
  const [preuveKind, setPreuveKind] = useState<string>("PV_TRESORERIE");
  const [preuveRef, setPreuveRef] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allocs, setAllocs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setMontantACorriger(netRestant);
      setMotif("");
      setPreuveKind("PV_TRESORERIE");
      setPreuveRef("");
      setConfirm(false);
      const init: Record<string, string> = {};
      for (const l of lignes) {
        init[l.id] = "";
      }
      setAllocs(init);
    }
  }, [open, netRestant, lignes]);

  const allocSumLabel = useMemo(() => {
    if (reglementType !== "COMPENSATION") return null;
    let cents = 0;
    try {
      for (const v of Object.values(allocs)) {
        if (!v?.trim()) continue;
        cents += parseMoneyToCents(v);
      }
      return (cents / 100).toFixed(2);
    } catch {
      return "—";
    }
  }, [allocs, reglementType]);

  async function onConfirm() {
    if (!confirm) {
      toast.warning("Cochez la confirmation avant d'enregistrer");
      return;
    }
    setSubmitting(true);
    try {
      const allocations =
        reglementType === "COMPENSATION"
          ? Object.entries(allocs)
              .filter(([, v]) => v?.trim())
              .map(([reglementLigneId, montantARestaurer]) => ({
                reglementLigneId,
                montantARestaurer,
              }))
          : undefined;
      const res = await actionCorrectNoteFraisReglement({
        noteId,
        reglementId,
        expectedNoteVersion: expectedVersion,
        idempotencyKey,
        type: "MONTANT_NEGATIF",
        montantACorriger,
        allocations,
        motif,
        preuveKind,
        preuveRef,
      });
      if (!res.success) {
        toast.error(messageErreurNoteFrais(res.code, res.error));
        return;
      }
      toast.success(res.message || "Correction de montant enregistrée");
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
      title="Corriger un montant (erreur d'enregistrement)"
      description="Correction négative append-only. Ne crée jamais de restitution bancaire. Les objets d'origine restent immuables."
      icon={<MinusCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="correct-montant-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting || !confirm}
            data-testid="confirm-correct-montant"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Enregistrer la correction
          </Button>
        </>
      }
    >
      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <NoteFraisMontantBadge label="Net restant" value={netRestant} />
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>
            Montant à corriger (positif)
          </Label>
          <Input
            className={FRAIS_AVANCES_INPUT_CLASS}
            value={montantACorriger}
            onChange={(e) => setMontantACorriger(e.target.value)}
            inputMode="decimal"
            data-testid="correct-montant-value"
          />
        </div>

        {reglementType === "COMPENSATION" ? (
          <div className="space-y-2">
            <p className={FRAIS_AVANCES_LABEL_CLASS}>
              Répartition sur les lignes (somme = montant)
              {allocSumLabel != null ? ` — Σ ${allocSumLabel}` : null}
            </p>
            {lignes.map((l) => (
              <div key={l.id} className="grid gap-1 sm:grid-cols-2">
                <span className="text-xs text-slate-600">
                  L{l.rang} {l.typeCible} (max {l.montantRestaurable})
                </span>
                <Input
                  className={FRAIS_AVANCES_INPUT_CLASS}
                  value={allocs[l.id] ?? ""}
                  onChange={(e) =>
                    setAllocs((prev) => ({ ...prev, [l.id]: e.target.value }))
                  }
                  inputMode="decimal"
                  placeholder="0.00"
                  data-testid={`correct-alloc-${l.id}`}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>Motif</Label>
          <Textarea
            className={FRAIS_AVANCES_INPUT_CLASS}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            maxLength={2000}
            rows={3}
            data-testid="correct-montant-motif"
          />
        </div>
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>Type de preuve</Label>
          <Select value={preuveKind} onValueChange={setPreuveKind}>
            <SelectTrigger
              className={FRAIS_AVANCES_INPUT_CLASS}
              data-testid="correct-preuve-kind"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREUVE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>
            Référence de preuve (id technique, pas d&apos;email/IBAN)
          </Label>
          <Input
            className={FRAIS_AVANCES_INPUT_CLASS}
            value={preuveRef}
            onChange={(e) => setPreuveRef(e.target.value)}
            maxLength={64}
            data-testid="correct-preuve-ref"
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            className="mt-0.5"
            data-testid="correct-montant-confirm"
          />
          <span>
            Je confirme une erreur d&apos;enregistrement uniquement — pas une
            restitution d&apos;un remboursement réellement envoyé.
          </span>
        </label>
      </div>
    </FraisAvancesDialogShell>
  );
}
