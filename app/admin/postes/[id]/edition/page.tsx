"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { getPosteTemplateById, updatePosteTemplate } from "@/actions/postes";
import { toast } from "sonner";

type FormState = {
  code: string;
  libelle: string;
  description: string;
  ordre: number;
  actif: boolean;
  nombreMandatsDefaut: number;
  dureeMandatDefaut: number | undefined;
};

export default function EditionPostePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  const [poste, setPoste] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormState>({
    code: "",
    libelle: "",
    description: "",
    ordre: 0,
    actif: true,
    nombreMandatsDefaut: 1,
    dureeMandatDefaut: undefined,
  });
  const [initialForm, setInitialForm] = useState(formData);

  useEffect(() => {
    if (id) {
      loadPoste();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(JSON.stringify(formData) !== JSON.stringify(initialForm));
  }, [formData, initialForm]);

  const loadPoste = async () => {
    try {
      setLoading(true);
      const result = await getPosteTemplateById(id);
      if (result.success && result.data) {
        setPoste(result.data);
        const init: FormState = {
          code: result.data.code,
          libelle: result.data.libelle,
          description: result.data.description || "",
          ordre: result.data.ordre,
          actif: result.data.actif,
          nombreMandatsDefaut: result.data.nombreMandatsDefaut,
          dureeMandatDefaut: result.data.dureeMandatDefaut,
        };
        setFormData(init);
        setInitialForm(init);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!poste) return;
    try {
      const result = await updatePosteTemplate(id, formData as any);
      if (result.success) {
        toast.success("Poste mis à jour");
        router.back();
      } else {
        toast.error(result.error || "Échec de l'enregistrement");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  if (loading) {
    return (
      <Modal title="Éditer le poste" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!poste) {
    return (
      <Modal title="Éditer le poste" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Poste introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal 
      title="Éditer le poste" 
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
          <div className="space-y-2">
            <Label htmlFor="libelle">Libellé *</Label>
            <Input
              id="libelle"
              value={formData.libelle}
              onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code (6 caractères)</Label>
            <Input
              id="code"
              value={formData.code}
              disabled
              readOnly
              maxLength={6}
              className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
              title="Le code ne peut pas être modifié après la création"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
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

