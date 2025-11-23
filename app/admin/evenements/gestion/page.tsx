"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { ImagesUpload } from "@/components/ui/images-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createEvenement } from "@/actions/evenements";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Euro, 
  Mail, 
  Phone, 
  Tag, 
  FileText,
  Image as ImageIcon,
  Globe,
  Lock
} from "lucide-react";

const categories = [
  { value: "General", label: "Général", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800" },
  { value: "Formation", label: "Formation", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800" },
  { value: "Social", label: "Social", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800" },
  { value: "Sportif", label: "Sportif", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800" },
  { value: "Culturel", label: "Culturel", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 border-pink-200 dark:border-pink-800" },
];

const statuts = [
  { value: "Brouillon", label: "Brouillon", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800" },
  { value: "Publie", label: "Publié", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800" },
  { value: "Archive", label: "Archivé", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800" },
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
    estPublic: true,
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
        estPublic: form.estPublic,
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

  const categorieInfo = categories.find(c => c.value === form.categorie);
  const statutInfo = statuts.find(s => s.value === form.statut);

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
      <div className="space-y-2 sm:space-y-3 max-h-[85vh] overflow-y-auto px-1">
        {/* Header avec titre et badges */}
        <Card className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/20 dark:via-slate-900 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow-md !py-0">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg py-1.5 px-2 sm:px-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
                <Calendar className="h-3.5 w-3.5" />
                <Input 
                  value={form.titre} 
                  onChange={(e) => setForm({ ...form, titre: e.target.value })} 
                  className="bg-transparent border-none text-white placeholder:text-white/70 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs sm:text-sm font-semibold p-0 h-auto"
                  placeholder="Titre de l'événement"
                  required
                />
              </CardTitle>
              <div className="flex items-center gap-2">
                {categorieInfo && (
                  <Badge className={`${categorieInfo.color} border text-xs px-2 py-0.5`}>
                    {categorieInfo.label}
                  </Badge>
                )}
                {statutInfo && (
                  <Badge className={`${statutInfo.color} border text-xs px-2 py-0.5`}>
                    {statutInfo.label}
                  </Badge>
                )}
                <Badge className={`${form.estPublic ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800" : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800"} border text-xs px-2 py-0.5 flex items-center gap-1`}>
                  {form.estPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {form.estPublic ? "Public" : "Privé"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Date de début</Label>
                  <Input 
                    type="datetime-local" 
                    value={form.dateDebut} 
                    onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} 
                    className="h-6 text-xs p-1 border-0 bg-transparent focus-visible:ring-0"
                    required
                  />
                </div>
              </div>
              {form.dateFin && (
                <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <Clock className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Date de fin</Label>
                    <Input 
                      type="datetime-local" 
                      value={form.dateFin} 
                      onChange={(e) => setForm({ ...form, dateFin: e.target.value })} 
                      className="h-6 text-xs p-1 border-0 bg-transparent focus-visible:ring-0"
                    />
                  </div>
                </div>
              )}
              {form.lieu && (
                <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <MapPin className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Lieu</Label>
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{form.lieu || "—"}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 1. Informations générales */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>1. Informations générales</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea 
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm min-h-[60px]"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Contenu détaillé
                </Label>
                <Textarea 
                  value={form.contenu} 
                  onChange={(e) => setForm({ ...form, contenu: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    Catégorie <span className="text-red-500">*</span>
                  </Label>
                  <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v as any })}>
                    <SelectTrigger className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    Statut <span className="text-red-500">*</span>
                  </Label>
                  <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v as any })}>
                    <SelectTrigger className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuts.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Dates et horaires */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              <span>2. Dates et horaires</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Date de début <span className="text-red-500">*</span>
                </Label>
                <Input 
                  type="datetime-local" 
                  value={form.dateDebut} 
                  onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Date de fin
                </Label>
                <Input 
                  type="datetime-local" 
                  value={form.dateFin} 
                  onChange={(e) => setForm({ ...form, dateFin: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Date d'affichage <span className="text-red-500">*</span>
                </Label>
                <Input 
                  type="datetime-local" 
                  value={form.dateAffichage} 
                  onChange={(e) => setForm({ ...form, dateAffichage: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Date de fin d'affichage <span className="text-red-500">*</span>
                </Label>
                <Input 
                  type="datetime-local" 
                  value={form.dateFinAffichage} 
                  onChange={(e) => setForm({ ...form, dateFinAffichage: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Localisation */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <MapPin className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>3. Localisation</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Lieu
                </Label>
                <Input 
                  value={form.lieu} 
                  onChange={(e) => setForm({ ...form, lieu: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Adresse
                </Label>
                <Input 
                  value={form.adresse} 
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Tarification et inscription */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <Euro className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>4. Tarification et inscription</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Prix (€)
                </Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={form.prix} 
                  onChange={(e) => setForm({ ...form, prix: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Places disponibles
                </Label>
                <Input 
                  type="number" 
                  value={form.placesDisponibles} 
                  onChange={(e) => setForm({ ...form, placesDisponibles: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Date limite d'inscription
                </Label>
                <Input 
                  type="datetime-local" 
                  value={form.dateLimiteInscription} 
                  onChange={(e) => setForm({ ...form, dateLimiteInscription: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Options
                </Label>
                <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 shadow-sm space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="inscriptionRequis" 
                      checked={form.inscriptionRequis} 
                      onChange={(e) => setForm({ ...form, inscriptionRequis: e.target.checked })} 
                      className="rounded" 
                    />
                    <Label htmlFor="inscriptionRequis" className="text-xs font-medium text-slate-900 dark:text-slate-100 cursor-pointer">
                      Inscription requise
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="estPublic" 
                      checked={form.estPublic} 
                      onChange={(e) => setForm({ ...form, estPublic: e.target.checked })} 
                      className="rounded" 
                    />
                    <Label htmlFor="estPublic" className="text-xs font-medium text-slate-900 dark:text-slate-100 cursor-pointer">
                      Événement public
                    </Label>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 ml-6">
                    {form.estPublic 
                      ? "Visible par tout le monde sur /evenements" 
                      : "Réservé aux adhérents sur /agenda"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Contact */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <Mail className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>5. Contact</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Email de contact
                </Label>
                <Input 
                  type="email" 
                  value={form.contactEmail} 
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Téléphone de contact
                </Label>
                <Input 
                  value={form.contactTelephone} 
                  onChange={(e) => setForm({ ...form, contactTelephone: e.target.value })} 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Médias */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <ImageIcon className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
              <span>6. Médias</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Image principale
                </Label>
                <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 shadow-sm">
                  <ImageUpload
                    value={form.imagePrincipale}
                    onChange={(url) => setForm({ ...form, imagePrincipale: url })}
                    label=""
                    folder="evenements"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  Images supplémentaires
                </Label>
                <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 shadow-sm">
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
                    label=""
                    folder="evenements"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7. Tags */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <Tag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>7. Tags</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="space-y-1">
              <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                Tags (JSON array)
              </Label>
              <Textarea 
                value={form.tags} 
                onChange={(e) => setForm({ ...form, tags: e.target.value })} 
                className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm font-mono min-h-[60px]"
                placeholder='["important", "formation", ...]'
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </Modal>
  );
}
