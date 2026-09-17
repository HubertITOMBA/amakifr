"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionCreateNoteFraisDraft } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type CreateNoteFraisDraftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog de création d'un brouillon de note de frais.
 */
export function CreateNoteFraisDraftDialog({
  open,
  onOpenChange,
}: CreateNoteFraisDraftDialogProps) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [dateDepense, setDateDepense] = useState("");
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setLibelle("");
    setDescription("");
    setDateDepense("");
    setMontant("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await actionCreateNoteFraisDraft({
        libelle,
        description,
        dateDepense,
        montantDemande: montant.trim(),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message || "Brouillon créé");
      reset();
      onOpenChange(false);
      router.push(`/user/frais-avances/${res.data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) reset();
        onOpenChange(next);
      }}
      title="Nouveau brouillon"
      description="Saisissez les informations minimales de la dépense."
      icon={<FilePlus2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="create-note-frais-draft-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-sm h-8 sm:h-9 border-slate-300"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="create-note-frais-draft-form"
            disabled={loading}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm h-8 sm:h-9"
            data-testid="create-note-frais-draft-submit"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création…
              </>
            ) : (
              "Créer le brouillon"
            )}
          </Button>
        </>
      }
    >
      <form
        id="create-note-frais-draft-form"
        onSubmit={onSubmit}
        className="space-y-3"
      >
        <section className={FRAIS_AVANCES_SECTION_CLASS}>
          <div className="space-y-1">
            <Label htmlFor="nf-draft-libelle" className={FRAIS_AVANCES_LABEL_CLASS}>
              Libellé *
            </Label>
            <Input
              id="nf-draft-libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. : Achat matériel événement"
              required
              className={FRAIS_AVANCES_INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="nf-draft-date" className={FRAIS_AVANCES_LABEL_CLASS}>
                Date de dépense *
              </Label>
              <Input
                id="nf-draft-date"
                type="date"
                value={dateDepense}
                onChange={(e) => setDateDepense(e.target.value)}
                required
                className={FRAIS_AVANCES_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nf-draft-montant" className={FRAIS_AVANCES_LABEL_CLASS}>
                Montant demandé (€) *
              </Label>
              <Input
                id="nf-draft-montant"
                type="number"
                step="0.01"
                min="0.01"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0.00"
                required
                className={FRAIS_AVANCES_INPUT_CLASS}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nf-draft-desc" className={FRAIS_AVANCES_LABEL_CLASS}>
              Description
            </Label>
            <Textarea
              id="nf-draft-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte facultatif"
              rows={3}
              className="text-sm min-h-[4.5rem] border-slate-300"
            />
          </div>
        </section>
      </form>
    </FraisAvancesDialogShell>
  );
}
