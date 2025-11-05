"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { ImagesUpload } from "@/components/ui/images-upload";
import { createEvenement } from "@/actions/evenements";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const categories = [
  { value: "General", label: "Général" },
  { value: "Formation", label: "Formation" },
  { value: "Social", label: "Social" },
  { value: "Sportif", label: "Sportif" },
  { value: "Culturel", label: "Culturel" },
];

const statuts = [
  { value: "Brouillon", label: "Brouillon" },
  { value: "Publie", label: "Publié" },
  { value: "Archive", label: "Archivé" },
];

export default function GestionEvenementsPage() {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    description: "",
    contenu: "",
    dateDebut: "",
    dateFin: "",
    dateAffichage: "",
    dateFinAffichage: "",
    lieu: "",
    adresse: "",
    categorie: "General" as "General" | "Formation" | "Social" | "Sportif" | "Culturel",
    statut: "Brouillon" as "Brouillon" | "Publie" | "Archive",
    imagePrincipale: "",
    images: "",
    prix: "",
    placesDisponibles: "",
    inscriptionRequis: false,
    dateLimiteInscription: "",
    contactEmail: "",
    contactTelephone: "",
    tags: "",
  });
  const [initialForm] = useState(form);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  const handleSave = async () => {
    // Validation côté client des champs obligatoires
    if (!form.titre.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    if (!form.description.trim()) {
      toast.error("La description est obligatoire");
      return;
    }
    if (!form.dateDebut) {
      toast.error("La date de début est obligatoire");
      return;
    }
    if (!form.dateAffichage) {
      toast.error("La date d'affichage est obligatoire");
      return;
    }
    if (!form.dateFinAffichage) {
      toast.error("La date de fin d'affichage est obligatoire");
      return;
    }
    
    try {
      const submissionData = {
        ...form,
        categorie: form.categorie,
        statut: form.statut,
        images: form.images || "",
        tags: form.tags || "",
        imagePrincipale: form.imagePrincipale || "",
        contenu: form.contenu || "",
        lieu: form.lieu || "",
        adresse: form.adresse || "",
        prix: form.prix || "",
        placesDisponibles: form.placesDisponibles || "",
        dateFin: form.dateFin || "",
        dateLimiteInscription: form.dateLimiteInscription || "",
        contactEmail: form.contactEmail || "",
        contactTelephone: form.contactTelephone || "",
      } as any;
      const res = await createEvenement(submissionData);
      if (res.success) {
        toast.success("Événement créé");
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
      title="Nouvel événement" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Créer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="titre" className="flex items-center gap-1">
              Titre <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="titre" 
              value={form.titre} 
              onChange={(e) => setForm({ ...form, titre: e.target.value })} 
              required 
              className={!form.titre.trim() ? "border-red-300 focus:border-red-500" : ""}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description" className="flex items-center gap-1">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea 
              id="description" 
              rows={2} 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              required 
              className={!form.description.trim() ? "border-red-300 focus:border-red-500" : ""}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="contenu">Contenu</Label>
            <Textarea id="contenu" rows={4} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateDebut" className="flex items-center gap-1">
              Date de début <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="dateDebut" 
              type="datetime-local" 
              value={form.dateDebut} 
              onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} 
              required 
              className={!form.dateDebut ? "border-red-300 focus:border-red-500" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateFin">Date de fin</Label>
            <Input id="dateFin" type="datetime-local" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateAffichage" className="flex items-center gap-1">
              Date d'affichage <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="dateAffichage" 
              type="datetime-local" 
              value={form.dateAffichage} 
              onChange={(e) => setForm({ ...form, dateAffichage: e.target.value })} 
              required 
              className={!form.dateAffichage ? "border-red-300 focus:border-red-500" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateFinAffichage" className="flex items-center gap-1">
              Date de fin d'affichage <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="dateFinAffichage" 
              type="datetime-local" 
              value={form.dateFinAffichage} 
              onChange={(e) => setForm({ ...form, dateFinAffichage: e.target.value })} 
              required 
              className={!form.dateFinAffichage ? "border-red-300 focus:border-red-500" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lieu">Lieu</Label>
            <Input id="lieu" value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categorie" className="flex items-center gap-1">
              Catégorie <span className="text-red-500">*</span>
            </Label>
            <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v as any })}>
              <SelectTrigger className={!form.categorie ? "border-red-300 focus:border-red-500" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="statut" className="flex items-center gap-1">
              Statut <span className="text-red-500">*</span>
            </Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v as any })}>
              <SelectTrigger className={!form.statut ? "border-red-300 focus:border-red-500" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuts.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prix">Prix</Label>
            <Input id="prix" type="number" step="0.01" value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="placesDisponibles">Places disponibles</Label>
            <Input id="placesDisponibles" type="number" value={form.placesDisponibles} onChange={(e) => setForm({ ...form, placesDisponibles: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <ImageUpload
              value={form.imagePrincipale}
              onChange={(url) => setForm({ ...form, imagePrincipale: url })}
              label="Image principale"
              folder="evenements"
            />
          </div>
          <div className="md:col-span-2">
            <ImagesUpload
              value={
                form.images && form.images.trim()
                  ? (() => {
                      try {
                        return JSON.parse(form.images);
                      } catch {
                        return [];
                      }
                    })()
                  : []
              }
              onChange={(urls) => setForm({ ...form, images: JSON.stringify(urls) })}
              label="Images supplémentaires"
              folder="evenements"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email de contact</Label>
            <Input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactTelephone">Téléphone de contact</Label>
            <Input id="contactTelephone" value={form.contactTelephone} onChange={(e) => setForm({ ...form, contactTelephone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateLimiteInscription">Date limite d'inscription</Label>
            <Input id="dateLimiteInscription" type="datetime-local" value={form.dateLimiteInscription} onChange={(e) => setForm({ ...form, dateLimiteInscription: e.target.value })} />
          </div>
          <div className="md:col-span-2 flex items-center space-x-2">
            <input type="checkbox" id="inscriptionRequis" checked={form.inscriptionRequis} onChange={(e) => setForm({ ...form, inscriptionRequis: e.target.checked })} className="rounded" />
            <Label htmlFor="inscriptionRequis">Inscription requise</Label>
          </div>
        </div>
      </div>
    </Modal>
  );
}

