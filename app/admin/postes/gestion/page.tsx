"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPosteTemplate } from "@/actions/postes";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type FormState = {
  libelle: string;
  description: string;
  ordre: number;
  actif: boolean;
  nombreMandatsDefaut: number;
  dureeMandatDefaut: number | undefined;
};

export default function GestionPostesPage() {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    libelle: "",
    description: "",
    ordre: 0,
    actif: true,
    nombreMandatsDefaut: 1,
    dureeMandatDefaut: undefined,
  });
  const [initialForm] = useState(formData);

  useEffect(() => {
    setIsDirty(JSON.stringify(formData) !== JSON.stringify(initialForm));
  }, [formData, initialForm]);

  const handleLibelleChange = (libelle: string) => {
    setFormData((prev) => ({
      ...prev,
      libelle,
      // Le code sera généré automatiquement côté serveur
    }));
  };

  const handleSave = async () => {
    try {
      const result = await createPosteTemplate(formData as any);
      if (result.success) {
        toast.success("Poste créé");
        router.back();
      } else {
        toast.error(result.error || "Échec de l'enregistrement");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <Modal 
      title="Nouveau poste" 
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
            <Input
              id="libelle"
              value={formData.libelle}
              onChange={(e) => handleLibelleChange(e.target.value)}
              placeholder="Ex: Président"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Description du poste"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ordre">Ordre d'affichage</Label>
            <Input
              id="ordre"
              type="number"
              value={formData.ordre}
              onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombreMandatsDefaut">Nombre de mandats par défaut</Label>
            <Input
              id="nombreMandatsDefaut"
              type="number"
              min={1}
              value={formData.nombreMandatsDefaut}
              onChange={(e) => setFormData({ ...formData, nombreMandatsDefaut: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dureeMandatDefaut">Durée du mandat (en mois)</Label>
            <Input
              id="dureeMandatDefaut"
              type="number"
              min={1}
              value={formData.dureeMandatDefaut || ""}
              onChange={(e) => setFormData({ ...formData, dureeMandatDefaut: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="Optionnel"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

