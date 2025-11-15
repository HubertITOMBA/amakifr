"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, User, MapPin, Building, Phone, Plus, Trash2, Calendar, Users, Briefcase, Heart, Shield, Mail, Info } from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { getUserData, updateUserData } from "@/actions/user";

interface UserData {
  name: string;
  email: string;
  image?: string;
}

interface AdherentData {
  civility: string;
  firstname: string;
  lastname: string;
  dateNaissance?: string;
  typeAdhesion?: string;
  profession?: string;
  centresInteret?: string;
  autorisationImage: boolean;
  accepteCommunications: boolean;
  nombreEnfants: number;
  evenementsFamiliaux: string[];
}

interface AdresseData {
  streetnum?: string;
  street1?: string;
  street2?: string;
  codepost?: string;
  city?: string;
  country?: string;
}

interface TelephoneData {
  id?: string;
  numero: string;
  type: "Mobile" | "Fixe" | "Professionnel";
  estPrincipal: boolean;
  description?: string;
}

interface EnfantData {
  id?: string;
  prenom: string;
  dateNaissance?: string;
  age?: number;
}

export default function UpdateUserPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Données du formulaire
  const [userData, setUserData] = useState<UserData>({
    name: "",
    email: "",
    image: ""
  });
  
  const [adherentData, setAdherentData] = useState<AdherentData>({
    civility: "Monsieur",
    firstname: "",
    lastname: "",
    autorisationImage: false,
    accepteCommunications: true,
    nombreEnfants: 0,
    evenementsFamiliaux: []
  });
  
  const [adresseData, setAdresseData] = useState<AdresseData>({
    streetnum: "",
    street1: "",
    street2: "",
    codepost: "",
    city: "",
    country: "France"
  });
  
  const [telephonesData, setTelephonesData] = useState<TelephoneData[]>([]);
  const [enfantsData, setEnfantsData] = useState<EnfantData[]>([]);

  // Charger les données utilisateur
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const result = await getUserData();
        if (result.success && result.user) {
          const user = result.user;
          
          setUserData({
            name: user.name || "",
            email: user.email || "",
            image: user.image || ""
          });
          
          if (user.adherent) {
            const adherent = user.adherent;
            setAdherentData({
              civility: adherent.civility || "Monsieur",
              firstname: adherent.firstname || "",
              lastname: adherent.lastname || "",
              dateNaissance: adherent.dateNaissance ? new Date(adherent.dateNaissance).toISOString().split('T')[0] : "",
              typeAdhesion: adherent.typeAdhesion || "",
              profession: adherent.profession || "",
              centresInteret: adherent.centresInteret || "",
              autorisationImage: adherent.autorisationImage || false,
              accepteCommunications: adherent.accepteCommunications !== false,
              nombreEnfants: adherent.nombreEnfants || 0,
              evenementsFamiliaux: adherent.evenementsFamiliaux ? JSON.parse(adherent.evenementsFamiliaux) : []
            });
            
            if (adherent.Adresse && adherent.Adresse.length > 0) {
              const adresse = adherent.Adresse[0];
              setAdresseData({
                streetnum: adresse.streetnum || "",
                street1: adresse.street1 || "",
                street2: adresse.street2 || "",
                codepost: adresse.codepost || "",
                city: adresse.city || "",
                country: adresse.country || "France"
              });
            }
            
            if (adherent.Telephones && adherent.Telephones.length > 0) {
              setTelephonesData(adherent.Telephones.map((tel: any) => ({
                id: tel.id,
                numero: tel.numero,
                type: tel.type as "Mobile" | "Fixe" | "Professionnel",
                estPrincipal: tel.estPrincipal,
                description: tel.description || ""
              })));
            }

            if (adherent.Enfants && adherent.Enfants.length > 0) {
              setEnfantsData(adherent.Enfants.map((enfant: any) => ({
                id: enfant.id,
                prenom: enfant.prenom,
                dateNaissance: enfant.dateNaissance ? new Date(enfant.dateNaissance).toISOString().split('T')[0] : "",
                age: enfant.age || undefined
              })));
            }
          }
        } else {
          throw new Error(result.error || "Erreur lors du chargement des données");
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const result = await updateUserData(
        userData,
        adherentData,
        adresseData,
        telephonesData,
        enfantsData
      );

      if (result.success) {
        toast.success("Informations mises à jour avec succès !");
        router.push("/user/profile");
      } else {
        toast.error(result.message || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  // Fonctions pour gérer les téléphones
  const addTelephone = () => {
    setTelephonesData([...telephonesData, {
      numero: "",
      type: "Mobile",
      estPrincipal: telephonesData.length === 0,
      description: ""
    }]);
  };

  const removeTelephone = (index: number) => {
    const newTelephones = telephonesData.filter((_, i) => i !== index);
    if (telephonesData[index].estPrincipal && newTelephones.length > 0) {
      newTelephones[0].estPrincipal = true;
    }
    setTelephonesData(newTelephones);
  };

  const updateTelephone = (index: number, field: keyof TelephoneData, value: any) => {
    const newTelephones = [...telephonesData];
    newTelephones[index] = { ...newTelephones[index], [field]: value };
    
    if (field === 'estPrincipal' && value === true) {
      newTelephones.forEach((tel, i) => {
        if (i !== index) tel.estPrincipal = false;
      });
    }
    
    setTelephonesData(newTelephones);
  };

  // Fonctions pour gérer les enfants
  const addEnfant = () => {
    setEnfantsData([...enfantsData, {
      prenom: "",
      dateNaissance: "",
      age: undefined
    }]);
  };

  const removeEnfant = (index: number) => {
    setEnfantsData(enfantsData.filter((_, i) => i !== index));
  };

  const updateEnfant = (index: number, field: keyof EnfantData, value: any) => {
    const newEnfants = [...enfantsData];
    newEnfants[index] = { ...newEnfants[index], [field]: value };
    
    // Calculer l'âge si la date de naissance est fournie
    if (field === 'dateNaissance' && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      newEnfants[index].age = age;
    }
    
    setEnfantsData(newEnfants);
  };

  const handleImageChange = (imageUrl: string) => {
    setUserData({ ...userData, image: imageUrl });
  };

  const toggleEvenementFamilial = (type: string) => {
    const current = adherentData.evenementsFamiliaux || [];
    if (current.includes(type)) {
      setAdherentData({
        ...adherentData,
        evenementsFamiliaux: current.filter(t => t !== type)
      });
    } else {
      setAdherentData({
        ...adherentData,
        evenementsFamiliaux: [...current, type]
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/user/profile" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au profil
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Fiche d'adhésion - Informations complètes
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Complétez vos informations personnelles selon la fiche d'adhésion de l'association
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Photo de profil */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Photo de profil
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <PhotoUpload
                currentImage={userData.image || ""}
                userName={userData.name || ""}
                onImageChange={handleImageChange}
                size="md"
              />
            </CardContent>
          </Card>

          {/* 1. Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                1. Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="civility">Civilité</Label>
                  <Select
                    value={adherentData.civility}
                    onValueChange={(value) => setAdherentData({ ...adherentData, civility: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une civilité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monsieur">Monsieur</SelectItem>
                      <SelectItem value="Madame">Madame</SelectItem>
                      <SelectItem value="Mademoiselle">Mademoiselle</SelectItem>
                      <SelectItem value="Partenaire">Partenaire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="firstname">Prénom</Label>
                  <Input
                    id="firstname"
                    value={adherentData.firstname}
                    onChange={(e) => setAdherentData({ ...adherentData, firstname: e.target.value })}
                    placeholder="Votre prénom"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lastname">Nom de famille</Label>
                  <Input
                    id="lastname"
                    value={adherentData.lastname}
                    onChange={(e) => setAdherentData({ ...adherentData, lastname: e.target.value })}
                    placeholder="Votre nom de famille"
                  />
                </div>
                <div>
                  <Label htmlFor="dateNaissance">Date de naissance</Label>
                  <Input
                    id="dateNaissance"
                    type="date"
                    value={adherentData.dateNaissance || ""}
                    onChange={(e) => setAdherentData({ ...adherentData, dateNaissance: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userData.email}
                    onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    placeholder="votre@email.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="streetnum">Numéro de rue</Label>
                  <Input
                    id="streetnum"
                    value={adresseData.streetnum}
                    onChange={(e) => setAdresseData({ ...adresseData, streetnum: e.target.value })}
                    placeholder="123"
                  />
                </div>
                <div>
                  <Label htmlFor="street1">Rue</Label>
                  <Input
                    id="street1"
                    value={adresseData.street1}
                    onChange={(e) => setAdresseData({ ...adresseData, street1: e.target.value })}
                    placeholder="Rue de la Paix"
                  />
                </div>
                <div>
                  <Label htmlFor="street2">Complément d'adresse</Label>
                  <Input
                    id="street2"
                    value={adresseData.street2}
                    onChange={(e) => setAdresseData({ ...adresseData, street2: e.target.value })}
                    placeholder="Appartement, étage..."
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="codepost">Code postal</Label>
                  <Input
                    id="codepost"
                    value={adresseData.codepost}
                    onChange={(e) => setAdresseData({ ...adresseData, codepost: e.target.value })}
                    placeholder="75001"
                  />
                </div>
                <div>
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={adresseData.city}
                    onChange={(e) => setAdresseData({ ...adresseData, city: e.target.value })}
                    placeholder="Paris"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    value={adresseData.country}
                    onChange={(e) => setAdresseData({ ...adresseData, country: e.target.value })}
                    placeholder="France"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Téléphones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Téléphones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {telephonesData.map((telephone, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Téléphone {index + 1}
                    </h4>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={telephone.estPrincipal}
                          onChange={(e) => updateTelephone(index, 'estPrincipal', e.target.checked)}
                          className="rounded"
                        />
                        Principal
                      </label>
                      {telephonesData.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeTelephone(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`numero-${index}`}>Numéro</Label>
                      <Input
                        id={`numero-${index}`}
                        value={telephone.numero}
                        onChange={(e) => updateTelephone(index, 'numero', e.target.value)}
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`type-${index}`}>Type</Label>
                      <Select
                        value={telephone.type}
                        onValueChange={(value) => updateTelephone(index, 'type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mobile">Mobile</SelectItem>
                          <SelectItem value="Fixe">Fixe</SelectItem>
                          <SelectItem value="Professionnel">Professionnel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor={`description-${index}`}>Description (optionnel)</Label>
                    <Input
                      id={`description-${index}`}
                      value={telephone.description}
                      onChange={(e) => updateTelephone(index, 'description', e.target.value)}
                      placeholder="Ex: Bureau, Domicile..."
                    />
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addTelephone}
                className="w-full flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un téléphone
              </Button>
            </CardContent>
          </Card>

          {/* 2. Type d'adhésion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                2. Type d'adhésion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="typeAdhesion">Type d'adhésion</Label>
                <Select
                  value={adherentData.typeAdhesion || ""}
                  onValueChange={(value) => setAdherentData({ ...adherentData, typeAdhesion: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type d'adhésion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AdhesionAnnuelle">Adhésion annuelle</SelectItem>
                    <SelectItem value="Renouvellement">Renouvellement</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 3. Informations familiales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                3. Informations familiales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nombreEnfants">Nombre d'enfants</Label>
                <Input
                  id="nombreEnfants"
                  type="number"
                  min="0"
                  value={adherentData.nombreEnfants}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 0;
                    setAdherentData({ ...adherentData, nombreEnfants: count });
                    // Ajuster la liste des enfants
                    const currentCount = enfantsData.length;
                    if (count > currentCount) {
                      const newEnfants = [...enfantsData];
                      for (let i = currentCount; i < count; i++) {
                        newEnfants.push({ prenom: "", dateNaissance: "", age: undefined });
                      }
                      setEnfantsData(newEnfants);
                    } else if (count < currentCount) {
                      setEnfantsData(enfantsData.slice(0, count));
                    }
                  }}
                />
              </div>

              {enfantsData.length > 0 && (
                <div className="space-y-4">
                  <Label>Enfants (prénoms et dates de naissance / âges)</Label>
                  {enfantsData.map((enfant, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Enfant {index + 1}
                        </h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeEnfant(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={`enfant-prenom-${index}`}>Prénom</Label>
                          <Input
                            id={`enfant-prenom-${index}`}
                            value={enfant.prenom}
                            onChange={(e) => updateEnfant(index, 'prenom', e.target.value)}
                            placeholder="Prénom de l'enfant"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`enfant-date-${index}`}>Date de naissance</Label>
                          <Input
                            id={`enfant-date-${index}`}
                            type="date"
                            value={enfant.dateNaissance || ""}
                            onChange={(e) => updateEnfant(index, 'dateNaissance', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`enfant-age-${index}`}>Âge</Label>
                          <Input
                            id={`enfant-age-${index}`}
                            type="number"
                            min="0"
                            value={enfant.age || ""}
                            onChange={(e) => updateEnfant(index, 'age', parseInt(e.target.value) || undefined)}
                            placeholder="Âge"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label>Événements familiaux nécessitant l'assistance de l'association</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mariage-enfant"
                      checked={adherentData.evenementsFamiliaux.includes("MariageEnfant")}
                      onCheckedChange={() => toggleEvenementFamilial("MariageEnfant")}
                    />
                    <Label htmlFor="mariage-enfant" className="font-normal cursor-pointer">
                      Mariage d'un enfant
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="deces-famille"
                      checked={adherentData.evenementsFamiliaux.includes("DecesFamille")}
                      onCheckedChange={() => toggleEvenementFamilial("DecesFamille")}
                    />
                    <Label htmlFor="deces-famille" className="font-normal cursor-pointer">
                      Décès dans la famille
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="anniversaire-salle"
                      checked={adherentData.evenementsFamiliaux.includes("AnniversaireSalle")}
                      onCheckedChange={() => toggleEvenementFamilial("AnniversaireSalle")}
                    />
                    <Label htmlFor="anniversaire-salle" className="font-normal cursor-pointer">
                      Anniversaire organisé en salle
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="autre-evenement"
                      checked={adherentData.evenementsFamiliaux.includes("Autre")}
                      onCheckedChange={() => toggleEvenementFamilial("Autre")}
                    />
                    <Label htmlFor="autre-evenement" className="font-normal cursor-pointer">
                      Autre
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Informations complémentaires */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                4. Informations complémentaires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="profession">Profession (optionnel)</Label>
                <Input
                  id="profession"
                  value={adherentData.profession || ""}
                  onChange={(e) => setAdherentData({ ...adherentData, profession: e.target.value })}
                  placeholder="Votre profession"
                />
              </div>
              <div>
                <Label htmlFor="centresInteret">Centres d'intérêt</Label>
                <Textarea
                  id="centresInteret"
                  value={adherentData.centresInteret || ""}
                  onChange={(e) => setAdherentData({ ...adherentData, centresInteret: e.target.value })}
                  placeholder="Vos centres d'intérêt..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* 5. Autorisations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                5. Autorisations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autorisation-image"
                  checked={adherentData.autorisationImage}
                  onCheckedChange={(checked) => setAdherentData({ ...adherentData, autorisationImage: checked as boolean })}
                />
                <Label htmlFor="autorisation-image" className="font-normal cursor-pointer">
                  J'autorise l'association à utiliser mon image dans le cadre de ses activités.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accepte-communications"
                  checked={adherentData.accepteCommunications}
                  onCheckedChange={(checked) => setAdherentData({ ...adherentData, accepteCommunications: checked as boolean })}
                />
                <Label htmlFor="accepte-communications" className="font-normal cursor-pointer">
                  J'accepte de recevoir les communications de l'association.
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Mention RGPD */}
          <Card className="border-2 border-blue-300 dark:border-blue-600 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 shadow-lg !py-0">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Info className="h-5 w-5" />
                </div>
                <span>Mention d'information RGPD</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6 px-6">
              <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                Les informations recueillies sur ce formulaire sont enregistrées par l'association afin de gérer les adhésions et d'assurer l'assistance prévue dans les statuts, notamment lors des événements familiaux (mariage d'un enfant, décès, anniversaire). Les données collectées sont limitées à ce qui est strictement nécessaire. Elles sont destinées exclusivement aux membres du bureau de l'association et ne seront jamais transmises à des tiers sans votre accord. Vous pouvez exercer votre droit d'accès, de rectification ou de suppression de vos données en contactant l'association.
              </p>
            </CardContent>
          </Card>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/user/profile")}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
