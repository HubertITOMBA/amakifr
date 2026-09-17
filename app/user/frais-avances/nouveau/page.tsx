"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionCreateNoteFraisDraft } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  FRAIS_AVANCES_DIALOG_HEADER_CLASS,
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
} from "@/components/frais-avances/FraisAvancesDialogShell";

/**
 * Page de création d'un brouillon (même langage visuel que le dialog liste).
 */
export default function NouveauFraisAvancesPage() {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [dateDepense, setDateDepense] = useState("");
  const [montant, setMontant] = useState("");
  const [loading, setLoading] = useState(false);

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
      router.push(`/user/frais-avances/${res.data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-lg border-blue-200 shadow-lg overflow-hidden p-0 gap-0">
        <div className={FRAIS_AVANCES_DIALOG_HEADER_CLASS}>
          <h1 className="text-white text-base sm:text-lg font-bold flex items-center gap-2">
            <FilePlus2 className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
            Nouveau brouillon
          </h1>
          <p className="text-blue-50 text-xs sm:text-sm mt-1.5">
            Saisissez les informations minimales de la dépense.
          </p>
        </div>
        <CardContent className="px-4 sm:px-5 py-3 space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            <section className={FRAIS_AVANCES_SECTION_CLASS}>
              <div className="space-y-1">
                <Label htmlFor="libelle" className={FRAIS_AVANCES_LABEL_CLASS}>
                  Libellé *
                </Label>
                <Input
                  id="libelle"
                  value={libelle}
                  onChange={(e) => setLibelle(e.target.value)}
                  placeholder="Ex. : Achat matériel événement"
                  required
                  className={FRAIS_AVANCES_INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="date" className={FRAIS_AVANCES_LABEL_CLASS}>
                    Date de dépense *
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={dateDepense}
                    onChange={(e) => setDateDepense(e.target.value)}
                    required
                    className={FRAIS_AVANCES_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="montant" className={FRAIS_AVANCES_LABEL_CLASS}>
                    Montant demandé (€) *
                  </Label>
                  <Input
                    id="montant"
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
                <Label htmlFor="desc" className={FRAIS_AVANCES_LABEL_CLASS}>
                  Description
                </Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contexte facultatif"
                  rows={3}
                  className="text-sm min-h-[4.5rem] border-slate-300"
                />
              </div>
            </section>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => router.push("/user/frais-avances")}
                className="w-full sm:w-auto text-sm h-8 sm:h-9 border-slate-300"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm h-8 sm:h-9"
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
