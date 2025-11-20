"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createDepense } from "@/actions/depenses";
import { getAllTypesDepense } from "@/actions/depenses/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Euro, Receipt, Plus } from "lucide-react";

const categories = [
  "Frais de fonctionnement",
  "Événements",
  "Matériel",
  "Communication",
  "Formation",
  "Transport",
  "Autres"
];

export default function GestionDepensesPage() {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [typesDepense, setTypesDepense] = useState<any[]>([]);
  const [form, setForm] = useState({
    libelle: "",
    montant: 0,
    dateDepense: new Date().toISOString().split('T')[0],
    typeDepenseId: "",
    categorie: "",
    description: "",
    statut: "EnAttente" as "EnAttente" | "Valide" | "Rejete",
  });
  const [initialForm] = useState(form);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  useEffect(() => {
    const loadTypes = async () => {
      const result = await getAllTypesDepense();
      if (result.success && result.data) {
        setTypesDepense(result.data.filter((t: any) => t.actif));
      }
    };
    loadTypes();
  }, []);

  const handleSave = async () => {
    try {
      const res = await createDepense({
        ...form,
        typeDepenseId: form.typeDepenseId || null,
      });
      if (res.success) {
        toast.success("Dépense créée");
        router.back();
      } else {
        toast.error(res.error || "Erreur lors de la création");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <Modal 
      title="Nouvelle dépense" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Créer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        <Card className="!py-0 border-blue-200 dark:border-blue-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Informations de la dépense
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="libelle">Libellé *</Label>
            <Input id="libelle" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="montant">Montant *</Label>
            <div className="relative">
              <Input id="montant" type="number" step="0.01" min="0" value={form.montant} onChange={(e) => setForm({ ...form, montant: parseFloat(e.target.value) || 0 })} required />
              <Euro className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateDepense">Date *</Label>
            <Input id="dateDepense" type="date" value={form.dateDepense} onChange={(e) => setForm({ ...form, dateDepense: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="typeDepenseId">Type de dépense</Label>
            <Select 
              value={form.typeDepenseId || "none"} 
              onValueChange={(v) => setForm({ ...form, typeDepenseId: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun type</SelectItem>
                {typesDepense.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.titre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="categorie">Catégorie (ancien système)</Label>
            <Input 
              id="categorie" 
              value={form.categorie} 
              onChange={(e) => setForm({ ...form, categorie: e.target.value })} 
              placeholder="Catégorie (si pas de type)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statut">Statut</Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EnAttente">En Attente</SelectItem>
                <SelectItem value="Valide">Validé</SelectItem>
                <SelectItem value="Rejete">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  rows={3} 
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                  placeholder="Description détaillée de la dépense" 
                />
              </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                💡 <strong>Note :</strong> Les justificatifs peuvent être ajoutés après la création de la dépense depuis la page d'édition.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Modal>
  );
}

