"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDepense } from "@/actions/depenses";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Euro } from "lucide-react";

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
  const [form, setForm] = useState({
    libelle: "",
    montant: 0,
    dateDepense: new Date().toISOString().split('T')[0],
    categorie: "",
    description: "",
    justificatif: "",
    statut: "EnAttente" as "EnAttente" | "Valide" | "Rejete",
  });
  const [initialForm] = useState(form);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  const handleSave = async () => {
    try {
      const res = await createDepense(form);
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
            <Label htmlFor="categorie">Catégorie *</Label>
            <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="space-y-2">
            <Label htmlFor="justificatif">Justificatif (URL)</Label>
            <Input id="justificatif" value={form.justificatif} onChange={(e) => setForm({ ...form, justificatif: e.target.value })} placeholder="URL du fichier justificatif" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description détaillée de la dépense" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

