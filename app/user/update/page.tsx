"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, User, MapPin, Building, Phone, Plus, Trash2 } from "lucide-react";
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
    lastname: ""
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
            setAdherentData({
              civility: user.adherent.civility || "Monsieur",
              firstname: user.adherent.firstname || "",
              lastname: user.adherent.lastname || ""
            });
            
            if (user.adherent.Adresse && user.adherent.Adresse.length > 0) {
              const adresse = user.adherent.Adresse[0];
              setAdresseData({
                streetnum: adresse.streetnum || "",
                street1: adresse.street1 || "",
                street2: adresse.street2 || "",
                codepost: adresse.codepost || "",
                city: adresse.city || "",
                country: adresse.country || "France"
              });
            }
            
            if (user.adherent.Telephones && user.adherent.Telephones.length > 0) {
              setTelephonesData(user.adherent.Telephones.map((tel: any) => ({
                id: tel.id,
                numero: tel.numero,
                type: tel.type as "Mobile" | "Fixe" | "Professionnel",
                estPrincipal: tel.estPrincipal,
                description: tel.description || ""
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
        telephonesData
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
    // Si on supprime le téléphone principal, le premier devient principal
    if (telephonesData[index].estPrincipal && newTelephones.length > 0) {
      newTelephones[0].estPrincipal = true;
    }
    setTelephonesData(newTelephones);
  };

  const updateTelephone = (index: number, field: keyof TelephoneData, value: any) => {
    const newTelephones = [...telephonesData];
    newTelephones[index] = { ...newTelephones[index], [field]: value };
    
    // Si on marque un téléphone comme principal, les autres ne le sont plus
    if (field === 'estPrincipal' && value === true) {
      newTelephones.forEach((tel, i) => {
        if (i !== index) tel.estPrincipal = false;
      });
    }
    
    setTelephonesData(newTelephones);
  };

  const handleImageChange = (imageUrl: string) => {
    setUserData({ ...userData, image: imageUrl });
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
            Mise à jour des informations
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Modifiez vos informations personnelles, d'adhérent et d'adresse
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

          {/* Informations utilisateur */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    value={userData.name}
                    onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                    placeholder="Votre nom complet"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
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

          {/* Informations adhérent */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Informations adhérent
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
              </div>
            </CardContent>
          </Card>

          {/* Informations d'adresse */}
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

          {/* Informations téléphones */}
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
