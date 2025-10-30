"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Calendar, 
  MapPin, 
  Users, 
  Euro, 
  Image, 
  Edit, 
  Trash2, 
  Eye,
  Clock,
  Tag,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Archive
} from "lucide-react";
import { toast } from "react-hot-toast";
import { 
  createEvenement, 
  updateEvenement, 
  deleteEvenement, 
  getAllEvenements, 
  getEvenementsStats,
  type EvenementData 
} from "@/actions/evenements";
import { ImageUpload } from "@/components/ui/image-upload";
import { ImagesUpload } from "@/components/ui/images-upload";

interface EvenementFormData {
  titre: string;
  description: string;
  contenu: string;
  dateDebut: string;
  dateFin: string;
  dateAffichage: string;
  dateFinAffichage: string;
  lieu: string;
  adresse: string;
  categorie: string;
  statut: string;
  imagePrincipale: string;
  images: string;
  prix: string;
  placesDisponibles: string;
  inscriptionRequis: boolean;
  dateLimiteInscription: string;
  contactEmail: string;
  contactTelephone: string;
  tags: string;
}

interface EvenementsStats {
  totalEvenements: number;
  evenementsPublies: number;
  evenementsBrouillons: number;
  evenementsArchives: number;
  totalInscriptions: number;
  evenementsAvecInscriptions: number;
  tauxPublication: number;
  moyenneInscriptions: number;
}

export default function AdminEvenementsPage() {
  const [evenements, setEvenements] = useState<EvenementData[]>([]);
  const [stats, setStats] = useState<EvenementsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvenement, setEditingEvenement] = useState<EvenementData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState("Tous");
  const [selectedStatut, setSelectedStatut] = useState("Tous");
  const formRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<EvenementFormData>({
    titre: "",
    description: "",
    contenu: "",
    dateDebut: "",
    dateFin: "",
    dateAffichage: "",
    dateFinAffichage: "",
    lieu: "",
    adresse: "",
    categorie: "General",
    statut: "Brouillon",
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
  
  // État pour gérer les images supplémentaires comme tableau
  const [imagesArray, setImagesArray] = useState<string[]>([]);
  
  // État pour détecter les modifications non sauvegardées
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialFormData, setInitialFormData] = useState<EvenementFormData | null>(null);

  const categories = [
    { value: "General", label: "Général" },
    { value: "Formation", label: "Formation" },
    { value: "Social", label: "Social" },
    { value: "Sportif", label: "Sportif" },
    { value: "Culturel", label: "Culturel" },
  ];

  const statuts = [
    { value: "Brouillon", label: "Brouillon", color: "bg-gray-100 text-gray-800" },
    { value: "Publie", label: "Publié", color: "bg-green-100 text-green-800" },
    { value: "Archive", label: "Archivé", color: "bg-blue-100 text-blue-800" },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [evenementsResult, statsResult] = await Promise.all([
        getAllEvenements(),
        getEvenementsStats(),
      ]);

      if (evenementsResult.success && evenementsResult.data) {
        // Convertir les données pour correspondre au type EvenementData
        const formattedEvenements = evenementsResult.data.map((e: any) => ({
          ...e,
          contenu: e.contenu ?? undefined,
          images: e.images || undefined,
          tags: e.tags || undefined,
        }));
        setEvenements(formattedEvenements);
      }

      if (statsResult.success) {
        setStats(statsResult.data || null);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier les champs obligatoires
    const requiredErrors = getRequiredFieldsErrors();
    if (requiredErrors.length > 0) {
      toast.error(`Champs obligatoires manquants: ${requiredErrors.join(", ")}`);
      return;
    }

    try {
      setLoading(true);
      
      // Convertir le tableau d'images en JSON string pour la soumission
      const submissionData = {
        ...formData,
        images: imagesArray.length > 0 ? JSON.stringify(imagesArray) : formData.images,
        categorie: formData.categorie as "General" | "Formation" | "Social" | "Sportif" | "Culturel",
        statut: formData.statut as "Brouillon" | "Publie" | "Archive"
      } as any;
      
      if (editingEvenement) {
        const result = await updateEvenement(editingEvenement.id, submissionData);
        if (result.success) {
          toast.success("Événement mis à jour avec succès");
          setEditingEvenement(null);
          setHasUnsavedChanges(false);
          setInitialFormData(null);
        } else {
          toast.error(result.error || "Erreur lors de la mise à jour");
        }
      } else {
        const result = await createEvenement(submissionData);
        if (result.success) {
          toast.success("Événement créé avec succès");
          setHasUnsavedChanges(false);
          setInitialFormData(null);
        } else {
          toast.error(result.error || "Erreur lors de la création");
        }
      }

      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erreur lors de la soumission:", error);
      toast.error("Erreur lors de la soumission");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (evenement: EvenementData) => {
    setEditingEvenement(evenement);
    
    // Convertir les images en tableau si c'est un tableau ou une string JSON
    let imagesArrayData: string[] = [];
    if (evenement.images) {
      if (Array.isArray(evenement.images)) {
        imagesArrayData = evenement.images;
      } else {
        try {
          imagesArrayData = JSON.parse(evenement.images as string);
        } catch {
          imagesArrayData = [];
        }
      }
    }
    
    setImagesArray(imagesArrayData);
    const newFormData = {
      titre: evenement.titre,
      description: evenement.description,
      contenu: evenement.contenu || "",
      dateDebut: evenement.dateDebut.toISOString().slice(0, 16),
      dateFin: evenement.dateFin ? evenement.dateFin.toISOString().slice(0, 16) : "",
      dateAffichage: evenement.dateAffichage.toISOString().slice(0, 16),
      dateFinAffichage: evenement.dateFinAffichage.toISOString().slice(0, 16),
      lieu: evenement.lieu || "",
      adresse: evenement.adresse || "",
      categorie: evenement.categorie,
      statut: evenement.statut,
      imagePrincipale: evenement.imagePrincipale || "",
      images: evenement.images ? JSON.stringify(imagesArrayData) : "",
      prix: evenement.prix ? evenement.prix.toString() : "",
      placesDisponibles: evenement.placesDisponibles ? evenement.placesDisponibles.toString() : "",
      inscriptionRequis: evenement.inscriptionRequis,
      dateLimiteInscription: evenement.dateLimiteInscription ? evenement.dateLimiteInscription.toISOString().slice(0, 16) : "",
      contactEmail: evenement.contactEmail || "",
      contactTelephone: evenement.contactTelephone || "",
      tags: evenement.tags ? JSON.stringify(evenement.tags) : "",
    };
    setFormData(newFormData);
    setInitialFormData(newFormData);
    setHasUnsavedChanges(false);
    setShowForm(true);
    
    // Défilement automatique vers le formulaire après un court délai
    setTimeout(() => {
      formRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.")) {
      return;
    }

    try {
      setLoading(true);
      const result = await deleteEvenement(id);
      if (result.success) {
        toast.success("Événement supprimé avec succès");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const emptyForm = {
      titre: "",
      description: "",
      contenu: "",
      dateDebut: "",
      dateFin: "",
      dateAffichage: "",
      dateFinAffichage: "",
      lieu: "",
      adresse: "",
      categorie: "General",
      statut: "Brouillon",
      imagePrincipale: "",
      images: "",
      prix: "",
      placesDisponibles: "",
      inscriptionRequis: false,
      dateLimiteInscription: "",
      contactEmail: "",
      contactTelephone: "",
      tags: "",
    };
    setFormData(emptyForm);
    setImagesArray([]);
    setEditingEvenement(null);
    setInitialFormData(null);
    setHasUnsavedChanges(false);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm("Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir annuler ?")) {
        return;
      }
    }
    resetForm();
    setShowForm(false);
  };

  // Fonction pour vérifier les champs obligatoires
  const getRequiredFieldsErrors = () => {
    const errors: string[] = [];
    if (!formData.titre.trim()) errors.push("Titre");
    if (!formData.description.trim()) errors.push("Description");
    if (!formData.dateDebut) errors.push("Date de début");
    if (!formData.dateAffichage) errors.push("Date d'affichage");
    if (!formData.dateFinAffichage) errors.push("Date de fin d'affichage");
    return errors;
  };

  // Fonction pour vérifier si le formulaire a été modifié
  const checkFormChanges = () => {
    if (!initialFormData) return false;
    
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    const imagesChanged = JSON.stringify(imagesArray) !== JSON.stringify(
      initialFormData.images ? JSON.parse(initialFormData.images) : []
    );
    
    return formChanged || imagesChanged;
  };

  // Détecter les modifications
  useEffect(() => {
    const hasChanges = checkFormChanges();
    setHasUnsavedChanges(hasChanges);
  }, [formData, imagesArray, initialFormData]);

  // Prévenir la navigation si des modifications non sauvegardées
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && showForm) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, showForm]);

  const getFilteredEvenements = () => {
    return evenements.filter(evenement => {
      const matchesSearch = evenement.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           evenement.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategorie = selectedCategorie === "Tous" || evenement.categorie === selectedCategorie;
      const matchesStatut = selectedStatut === "Tous" || evenement.statut === selectedStatut;
      
      return matchesSearch && matchesCategorie && matchesStatut;
    });
  };

  const getStatutBadge = (statut: string) => {
    const statutInfo = statuts.find(s => s.value === statut);
    return (
      <Badge className={statutInfo?.color || "bg-gray-100 text-gray-800"}>
        {statutInfo?.label || statut}
      </Badge>
    );
  };

  const getCategorieBadge = (categorie: string) => {
    const categorieInfo = categories.find(c => c.value === categorie);
    return (
      <Badge variant="outline" className="text-xs">
        {categorieInfo?.label || categorie}
      </Badge>
    );
  };

  if (loading && evenements.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Événements
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Créez et gérez les événements de l'association
          </p>
        </div>
        <Button
          onClick={() => {
            if (hasUnsavedChanges && showForm) {
              if (!confirm("Vous avez des modifications non sauvegardées. Voulez-vous les perdre ?")) {
                return;
              }
            }
            resetForm();
            setShowForm(true);
            
            // Défilement automatique vers le formulaire après un court délai
            setTimeout(() => {
              formRef.current?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
              });
            }, 100);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvel Événement
        </Button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Total Événements
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalEvenements}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Publiés
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.evenementsPublies}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Brouillons
                  </p>
                  <p className="text-2xl font-bold text-gray-600">
                    {stats.evenementsBrouillons}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Inscriptions
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.totalInscriptions}
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div ref={formRef}>
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {editingEvenement ? "Modifier l'Événement" : "Nouvel Événement"}
              </CardTitle>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Modifications non sauvegardées
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Indicateur des champs obligatoires manquants */}
              {getRequiredFieldsErrors().length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Champs obligatoires manquants :
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                    {getRequiredFieldsErrors().map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informations de base */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="titre">
                      Titre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="titre"
                      value={formData.titre}
                      onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                      placeholder="Titre de l'événement"
                      required
                      className={!formData.titre.trim() ? "border-red-300 dark:border-red-700" : ""}
                    />
                    {!formData.titre.trim() && (
                      <p className="text-xs text-red-500 mt-1">Ce champ est obligatoire</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description courte de l'événement"
                      rows={3}
                      required
                      className={!formData.description.trim() ? "border-red-300 dark:border-red-700" : ""}
                    />
                    {!formData.description.trim() && (
                      <p className="text-xs text-red-500 mt-1">Ce champ est obligatoire</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="contenu">Contenu détaillé</Label>
                    <Textarea
                      id="contenu"
                      value={formData.contenu}
                      onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
                      placeholder="Contenu détaillé de l'événement"
                      rows={5}
                    />
                  </div>

                  <div>
                    <Label htmlFor="categorie">Catégorie</Label>
                    <Select
                      value={formData.categorie}
                      onValueChange={(value) => setFormData({ ...formData, categorie: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((categorie) => (
                          <SelectItem key={categorie.value} value={categorie.value}>
                            {categorie.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="statut">Statut</Label>
                    <Select
                      value={formData.statut}
                      onValueChange={(value) => setFormData({ ...formData, statut: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuts.map((statut) => (
                          <SelectItem key={statut.value} value={statut.value}>
                            {statut.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dates et lieu */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="dateDebut">
                      Date de début <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dateDebut"
                      type="datetime-local"
                      value={formData.dateDebut}
                      onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                      required
                      className={!formData.dateDebut ? "border-red-300 dark:border-red-700" : ""}
                    />
                    {!formData.dateDebut && (
                      <p className="text-xs text-red-500 mt-1">Ce champ est obligatoire</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="dateFin">Date de fin</Label>
                    <Input
                      id="dateFin"
                      type="datetime-local"
                      value={formData.dateFin}
                      onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateAffichage">
                      Date d'affichage <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dateAffichage"
                      type="datetime-local"
                      value={formData.dateAffichage}
                      onChange={(e) => setFormData({ ...formData, dateAffichage: e.target.value })}
                      required
                      className={!formData.dateAffichage ? "border-red-300 dark:border-red-700" : ""}
                    />
                    {!formData.dateAffichage && (
                      <p className="text-xs text-red-500 mt-1">Ce champ est obligatoire</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="dateFinAffichage">
                      Date de fin d'affichage <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dateFinAffichage"
                      type="datetime-local"
                      value={formData.dateFinAffichage}
                      onChange={(e) => setFormData({ ...formData, dateFinAffichage: e.target.value })}
                      required
                      className={!formData.dateFinAffichage ? "border-red-300 dark:border-red-700" : ""}
                    />
                    {!formData.dateFinAffichage && (
                      <p className="text-xs text-red-500 mt-1">Ce champ est obligatoire</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="lieu">Lieu</Label>
                    <Input
                      id="lieu"
                      value={formData.lieu}
                      onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                      placeholder="Lieu de l'événement"
                    />
                  </div>

                  <div>
                    <Label htmlFor="adresse">Adresse</Label>
                    <Textarea
                      id="adresse"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Adresse complète"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Images et médias */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Images et Médias</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <ImageUpload
                      value={formData.imagePrincipale}
                      onChange={(url) => setFormData({ ...formData, imagePrincipale: url })}
                      label="Image principale"
                      folder="evenements"
                      maxSize={10}
                    />
                  </div>

                  <div>
                    <ImagesUpload
                      value={imagesArray}
                      onChange={(urls) => {
                        setImagesArray(urls);
                        setFormData({ ...formData, images: JSON.stringify(urls) });
                      }}
                      label="Images supplémentaires"
                      folder="evenements"
                      maxSize={10}
                    />
                  </div>
                </div>
              </div>

              {/* Inscription et tarifs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Inscription et Tarifs</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="prix">Prix (€)</Label>
                    <Input
                      id="prix"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.prix}
                      onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="placesDisponibles">Places disponibles</Label>
                    <Input
                      id="placesDisponibles"
                      type="number"
                      min="1"
                      value={formData.placesDisponibles}
                      onChange={(e) => setFormData({ ...formData, placesDisponibles: e.target.value })}
                      placeholder="Nombre de places"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="inscriptionRequis"
                      checked={formData.inscriptionRequis}
                      onChange={(e) => setFormData({ ...formData, inscriptionRequis: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="inscriptionRequis">Inscription requise</Label>
                  </div>
                </div>

                {formData.inscriptionRequis && (
                  <div>
                    <Label htmlFor="dateLimiteInscription">Date limite d'inscription</Label>
                    <Input
                      id="dateLimiteInscription"
                      type="datetime-local"
                      value={formData.dateLimiteInscription}
                      onChange={(e) => setFormData({ ...formData, dateLimiteInscription: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactEmail">Email de contact</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="contact@exemple.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contactTelephone">Téléphone de contact</Label>
                    <Input
                      id="contactTelephone"
                      value={formData.contactTelephone}
                      onChange={(e) => setFormData({ ...formData, contactTelephone: e.target.value })}
                      placeholder="01 23 45 67 89"
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <Label htmlFor="tags">Tags (JSON)</Label>
                <Textarea
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder='["tag1", "tag2", "tag3"]'
                  rows={2}
                />
              </div>

              {/* Boutons */}
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? "Enregistrement..." : editingEvenement ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Filtres */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Rechercher</Label>
              <Input
                id="search"
                placeholder="Rechercher par titre ou description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="categorieFilter">Catégorie</Label>
              <Select value={selectedCategorie} onValueChange={setSelectedCategorie}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Toutes</SelectItem>
                  {categories.map((categorie) => (
                    <SelectItem key={categorie.value} value={categorie.value}>
                      {categorie.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="statutFilter">Statut</Label>
              <Select value={selectedStatut} onValueChange={setSelectedStatut}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Tous</SelectItem>
                  {statuts.map((statut) => (
                    <SelectItem key={statut.value} value={statut.value}>
                      {statut.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des événements */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getFilteredEvenements().map((evenement) => (
          <Card key={evenement.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg line-clamp-2">{evenement.titre}</CardTitle>
                <div className="flex space-x-2">
                  {getStatutBadge(evenement.statut)}
                  {getCategorieBadge(evenement.categorie)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                  {evenement.description}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>
                      {new Date(evenement.dateDebut).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {evenement.lieu && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{evenement.lieu}</span>
                    </div>
                  )}

                  {evenement.prix && evenement.prix > 0 && (
                    <div className="flex items-center space-x-2">
                      <Euro className="h-4 w-4 text-gray-400" />
                      <span>{evenement.prix.toFixed(2).replace('.', ',')} €</span>
                    </div>
                  )}

                  {evenement.inscriptionRequis && (
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>
                        {evenement.placesReservees}/{evenement.placesDisponibles || '∞'} places
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(evenement)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(evenement.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/evenements/${evenement.id}`, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Voir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {getFilteredEvenements().length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Aucun événement trouvé
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {searchTerm || selectedCategorie !== "Tous" || selectedStatut !== "Tous"
                ? "Aucun événement ne correspond à vos critères de recherche."
                : "Commencez par créer votre premier événement."}
            </p>
            {!searchTerm && selectedCategorie === "Tous" && selectedStatut === "Tous" && (
              <Button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                  
                  // Défilement automatique vers le formulaire après un court délai
                  setTimeout(() => {
                    formRef.current?.scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'start' 
                    });
                  }, 100);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer un événement
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
