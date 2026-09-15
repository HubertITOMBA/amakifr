"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionCreateNoteFraisDraft } from "@/actions/frais-avances";
import { toast } from "react-toastify";

/**
 * Création d'un brouillon de note de frais.
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
        montantDemande: Number(montant),
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
      <Card className="mx-auto max-w-xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white rounded-t-lg">
          <CardTitle>Nouveau brouillon</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="libelle">Libellé</Label>
              <Input
                id="libelle"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">Date de dépense</Label>
              <Input
                id="date"
                type="date"
                value={dateDepense}
                onChange={(e) => setDateDepense(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="montant">Montant demandé (€)</Label>
              <Input
                id="montant"
                type="number"
                step="0.01"
                min="0.01"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Création…" : "Créer le brouillon"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
