"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { getDepenseById, updateDepense } from "@/actions/depenses";
import { toast } from "sonner";
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

export default function EditionDepensePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  const [depense, setDepense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{
    libelle: string;
    montant: number;
    dateDepense: string;
    categorie: string;
    description: string;
    justificatif: string;
    statut: "EnAttente" | "Valide" | "Rejete";
  }>({
    libelle: "",
    montant: 0,
    dateDepense: "",
    categorie: "",
    description: "",
    justificatif: "",
    statut: "EnAttente",
  });
  const [initialForm, setInitialForm] = useState(form);

  useEffect(() => {
    if (id) {
      loadDepense();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  const loadDepense = async () => {
    try {
      setLoading(true);
      const result = await getDepenseById(id);
      if (result.success && result.data) {
        setDepense(result.data);
        const init = {
          libelle: result.data.libelle || "",
          montant: result.data.montant || 0,
          dateDepense: result.data.dateDepense || "",
          categorie: result.data.categorie || "",
          description: result.data.description || "",
          justificatif: result.data.justificatif || "",
          statut: result.data.statut || "EnAttente",
        };
        setForm(init);
        setInitialForm(init);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!depense) return;
    try {
      const res = await updateDepense({ id, ...form });
      if (res.success) {
        toast.success("Dépense mise à jour");
        router.back();
      } else {
        toast.error(res.error || "Erreur lors de la mise à jour");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  if (loading) {
    return (
      <Modal title="Éditer la dépense" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!depense) {
    return (
      <Modal title="Éditer la dépense" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Dépense introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal 
      title="Éditer la dépense" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="libelle">Libellé *</Label>
            <Input id="libelle" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="montant">Montant *</Label>
            <div className="relative">
              <Input id="montant" type="number" step="0.01" min="0" value={form.montant} onChange={(e) => setForm({ ...form, montant: parseFloat(e.target.value) || 0 })} required />
              <Euro className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div>
            <Label htmlFor="dateDepense">Date *</Label>
            <Input id="dateDepense" type="date" value={form.dateDepense} onChange={(e) => setForm({ ...form, dateDepense: e.target.value })} required />
          </div>
          <div>
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
          <div>
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
          <div>
            <Label htmlFor="justificatif">Justificatif (URL)</Label>
            <Input id="justificatif" value={form.justificatif} onChange={(e) => setForm({ ...form, justificatif: e.target.value })} placeholder="URL du fichier justificatif" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description détaillée de la dépense" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

