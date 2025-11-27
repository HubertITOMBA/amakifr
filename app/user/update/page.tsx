"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, User, MapPin, Building, Phone, Plus, Trash2, Calendar, Users, Briefcase, Heart, Shield, Mail, Info, Download } from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { getUserData, updateUserData } from "@/actions/user";
import { CountryAutocomplete } from "@/components/forms/country-autocomplete";
import { CityAutocomplete } from "@/components/forms/city-autocomplete";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import type { AddressResult } from "@/actions/location/search-address";

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
  datePremiereAdhesion?: string; // Date de première adhésion à l'association
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
  
  // Code pays pour l'autocomplétion des villes
  const [countryCode, setCountryCode] = useState<string>("FR");
  
  // Callbacks mémorisés pour éviter les boucles infinies
  const handleCityChange = useCallback((value: string) => {
    setAdresseData(prev => ({ ...prev, city: value }));
  }, []);
  
  const handleCountryChange = useCallback((value: string) => {
    setAdresseData(prev => ({ ...prev, country: value, city: "" }));
  }, []);
  
  const handleCountryCodeChange = useCallback((code: string) => {
    setCountryCode(code);
  }, []);
  
  const handleAddressChange = useCallback((address: AddressResult | null) => {
    if (address) {
      // Extraire le nom de la rue depuis le label (format: "10 rue de la Paix, 75001 Paris")
      const labelParts = address.label.split(",");
      const streetPart = labelParts[0] || "";
      // Enlever le numéro de rue si présent au début
      const streetName = streetPart.replace(/^\d+\s*/, "").trim();
      
      // Utiliser address.street si disponible, sinon extraire depuis le label
      const finalStreetName = address.street || streetName;
      
      // Détecter si c'est un code postal français (5 chiffres)
      const isFrenchPostcode = address.postcode && /^\d{5}$/.test(address.postcode);
      
      // Mettre à jour le code pays si c'est la France
      if (isFrenchPostcode) {
        setCountryCode("FR");
      }
      
      // Mettre à jour toutes les données d'adresse, y compris la ville
      setAdresseData(prev => ({
        ...prev,
        streetnum: address.housenumber || "",
        street1: finalStreetName, // Nom de la rue (sans numéro, sans code postal, sans ville)
        codepost: address.postcode || "",
        city: address.city || "", // La ville est maintenant correctement remplie
        // Si c'est un code postal français, mettre "France"
        country: isFrenchPostcode ? "France" : prev.country,
      }));
    } else {
      // Si l'adresse est null, réinitialiser
      setAdresseData(prev => ({
        ...prev,
        street1: "",
        codepost: "",
        city: "",
      }));
    }
  }, []);

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
              datePremiereAdhesion: adherent.datePremiereAdhesion ? new Date(adherent.datePremiereAdhesion).toISOString().split('T')[0] : "",
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
            <Link 
              href="/user/profile" 
              className="inline-flex items-center text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au profil
            </Link>
            
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  toast.loading("Génération du PDF en cours...");
                  // Import dynamique de jsPDF et des helpers
                  const { default: jsPDF } = await import('jspdf');
                  const { addPDFHeader, addPDFFooter } = await import('@/lib/pdf-helpers-client');
                  const doc = new jsPDF();
                  
                  // Ajouter l'en-tête avec logo
                  await addPDFHeader(doc, 'Fiche d\'adhésion - Informations complètes');
                  
                  let yPos = 70; // Commencer après l'en-tête (augmenté car l'en-tête est plus haut avec le titre)
                  
                  // Date de génération
                  doc.setFontSize(10);
                  doc.setTextColor(100, 100, 100);
                  doc.setFont('helvetica', 'normal');
                  doc.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
                  yPos += 10;
                  
                  // 1. Informations personnelles
                  doc.setFontSize(14);
                  doc.setTextColor(37, 99, 235); // blue-600
                  doc.setFont('helvetica', 'bold');
                  doc.text('1. Informations personnelles', 20, yPos);
                  yPos += 8;
                  
                  doc.setFontSize(10);
                  doc.setTextColor(0, 0, 0);
                  doc.setFont('helvetica', 'normal');
                  doc.text(`Civilité: ${adherentData.civility}`, 20, yPos);
                  yPos += 6;
                  doc.text(`Prénom: ${adherentData.firstname || 'Non renseigné'}`, 20, yPos);
                  yPos += 6;
                  doc.text(`Nom: ${adherentData.lastname || 'Non renseigné'}`, 20, yPos);
                  yPos += 6;
                  if (adherentData.dateNaissance) {
                    doc.text(`Date de naissance: ${new Date(adherentData.dateNaissance).toLocaleDateString('fr-FR')}`, 20, yPos);
                    yPos += 6;
                  }
                  if (adherentData.datePremiereAdhesion) {
                    doc.text(`Date de première adhésion: ${new Date(adherentData.datePremiereAdhesion).toLocaleDateString('fr-FR')}`, 20, yPos);
                    yPos += 6;
                  }
                  doc.text(`E-mail: ${userData.email || 'Non renseigné'}`, 20, yPos);
                  yPos += 10;
                  
                  // 2. Adresse
                  if (adresseData.street1 || adresseData.city) {
                    doc.setFontSize(14);
                    doc.setTextColor(22, 163, 74); // green-600
                    doc.setFont('helvetica', 'bold');
                    doc.text('2. Adresse', 20, yPos);
                    yPos += 8;
                    
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'normal');
                    const adresseParts = [];
                    if (adresseData.streetnum) adresseParts.push(adresseData.streetnum);
                    if (adresseData.street1) adresseParts.push(adresseData.street1);
                    if (adresseData.street2) adresseParts.push(adresseData.street2);
                    if (adresseParts.length > 0) {
                      doc.text(adresseParts.join(' '), 20, yPos);
                      yPos += 6;
                    }
                    if (adresseData.codepost || adresseData.city) {
                      doc.text(`${adresseData.codepost || ''} ${adresseData.city || ''}`.trim(), 20, yPos);
                      yPos += 6;
                    }
                    if (adresseData.country) {
                      doc.text(`Pays: ${adresseData.country}`, 20, yPos);
                      yPos += 6;
                    }
                    yPos += 4;
                  }
                  
                  // 3. Téléphones
                  if (telephonesData.length > 0) {
                    doc.setFontSize(14);
                    doc.setTextColor(147, 51, 234); // purple-600
                    doc.setFont('helvetica', 'bold');
                    doc.text('3. Téléphones', 20, yPos);
                    yPos += 8;
                    
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'normal');
                    telephonesData.forEach((tel, index) => {
                      if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                      }
                      const principal = tel.estPrincipal ? ' (Principal)' : '';
                      doc.text(`${index + 1}. ${tel.numero || 'Non renseigné'} - ${tel.type}${principal}`, 20, yPos);
                      yPos += 6;
                      if (tel.description) {
                        doc.text(`   Description: ${tel.description}`, 20, yPos);
                        yPos += 6;
                      }
                    });
                    yPos += 4;
                  }
                  
                  // 4. Type d'adhésion
                  if (adherentData.typeAdhesion) {
                    doc.setFontSize(14);
                    doc.setTextColor(249, 115, 22); // orange-600
                    doc.setFont('helvetica', 'bold');
                    doc.text('4. Type d\'adhésion', 20, yPos);
                    yPos += 8;
                    
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'normal');
                    const typeLabels: Record<string, string> = {
                      'AdhesionAnnuelle': 'Adhésion annuelle',
                      'Renouvellement': 'Renouvellement',
                      'Autre': 'Autre'
                    };
                    doc.text(`Type: ${typeLabels[adherentData.typeAdhesion] || adherentData.typeAdhesion}`, 20, yPos);
                    yPos += 10;
                  }
                  
                  // 5. Informations familiales
                  doc.setFontSize(14);
                  doc.setTextColor(236, 72, 153); // pink-600
                  doc.setFont('helvetica', 'bold');
                  doc.text('5. Informations familiales', 20, yPos);
                  yPos += 8;
                  
                  doc.setFontSize(10);
                  doc.setTextColor(0, 0, 0);
                  doc.setFont('helvetica', 'normal');
                  doc.text(`Nombre d'enfants: ${adherentData.nombreEnfants}`, 20, yPos);
                  yPos += 6;
                  
                  if (enfantsData.length > 0) {
                    enfantsData.forEach((enfant, index) => {
                      if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                      }
                      if (enfant.prenom) {
                        doc.text(`Enfant ${index + 1}: ${enfant.prenom}`, 20, yPos);
                        yPos += 6;
                        if (enfant.dateNaissance) {
                          doc.text(`   Date de naissance: ${new Date(enfant.dateNaissance).toLocaleDateString('fr-FR')}`, 20, yPos);
                          yPos += 6;
                        }
                        if (enfant.age) {
                          doc.text(`   Âge: ${enfant.age} ans`, 20, yPos);
                          yPos += 6;
                        }
                      }
                    });
                    yPos += 4;
                  }
                  
                  if (adherentData.evenementsFamiliaux && adherentData.evenementsFamiliaux.length > 0) {
                    const eventLabels: Record<string, string> = {
                      'Naissance': 'Naissance',
                      'MariageEnfant': 'Mariage d\'un enfant',
                      'DecesFamille': 'Décès dans la famille',
                      'AnniversaireSalle': 'Anniversaire organisé en salle',
                      'Autre': 'Autre'
                    };
                    doc.text('Événements familiaux:', 20, yPos);
                    yPos += 6;
                    adherentData.evenementsFamiliaux.forEach((event: string) => {
                      if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                      }
                      doc.text(`  • ${eventLabels[event] || event}`, 20, yPos);
                      yPos += 6;
                    });
                    yPos += 4;
                  }
                  
                  // 6. Informations complémentaires
                  if (adherentData.profession || adherentData.centresInteret) {
                    doc.setFontSize(14);
                    doc.setTextColor(99, 102, 241); // indigo-600
                    doc.setFont('helvetica', 'bold');
                    doc.text('6. Informations complémentaires', 20, yPos);
                    yPos += 8;
                    
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'normal');
                    if (adherentData.profession) {
                      doc.text(`Profession: ${adherentData.profession}`, 20, yPos);
                      yPos += 6;
                    }
                    if (adherentData.centresInteret) {
                      const centresLines = doc.splitTextToSize(`Centres d'intérêt: ${adherentData.centresInteret}`, 170);
                      doc.text(centresLines, 20, yPos);
                      yPos += centresLines.length * 5;
                    }
                    yPos += 4;
                  }
                  
                  // 7. Autorisations
                  doc.setFontSize(14);
                  doc.setTextColor(20, 184, 166); // teal-600
                  doc.setFont('helvetica', 'bold');
                  doc.text('7. Autorisations', 20, yPos);
                  yPos += 8;
                  
                  doc.setFontSize(10);
                  doc.setTextColor(0, 0, 0);
                  doc.setFont('helvetica', 'normal');
                  doc.text(`Autorisation d'image: ${adherentData.autorisationImage ? 'Oui' : 'Non'}`, 20, yPos);
                  yPos += 6;
                  doc.text(`Accepte les communications: ${adherentData.accepteCommunications ? 'Oui' : 'Non'}`, 20, yPos);
                  yPos += 10;
                  
                  // Mention RGPD
                  doc.setFontSize(12);
                  doc.setTextColor(37, 99, 235); // blue-600
                  doc.setFont('helvetica', 'bold');
                  doc.text('Mention d\'information RGPD', 20, yPos);
                  yPos += 8;
                  
                  doc.setFontSize(9);
                  doc.setTextColor(0, 0, 0);
                  doc.setFont('helvetica', 'normal');
                  const rgpdText = "Les informations recueillies sur ce formulaire sont enregistrées par l'association afin de gérer les adhésions et d'assurer l'assistance prévue dans les statuts, notamment lors des événements familiaux (naissance, mariage d'un enfant, décès, anniversaire). Les données collectées sont limitées à ce qui est strictement nécessaire. Elles sont destinées exclusivement aux membres du bureau de l'association et ne seront jamais transmises à des tiers sans votre accord. Vous pouvez exercer votre droit d'accès, de rectification ou de suppression de vos données en contactant l'association.";
                  const rgpdLines = doc.splitTextToSize(rgpdText, 170);
                  doc.text(rgpdLines, 20, yPos);
                  
                  // Ajouter le pied de page sur toutes les pages
                  addPDFFooter(doc);
                  
                  // Télécharger le PDF
                  const fileName = `fiche_adhesion_${adherentData.firstname || 'user'}_${adherentData.lastname || 'unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
                  doc.save(fileName);
                  toast.dismiss();
                  toast.success("PDF exporté avec succès");
                } catch (error) {
                  console.error("Erreur lors de l'export PDF:", error);
                  toast.dismiss();
                  toast.error("Erreur lors de l'export PDF");
                }
              }}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter en PDF
            </Button>
          </div>
          
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent mb-2 sm:mb-3">
            Fiche d'adhésion - Informations complètes
          </h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base lg:text-lg">
            Complétez vos informations personnelles selon la fiche d'adhésion de l'association
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Photo de profil */}
          <Card className="!py-0 shadow-xl border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Photo de profil
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 flex justify-center">
              <PhotoUpload
                currentImage={userData.image || ""}
                userName={userData.name || ""}
                onImageChange={handleImageChange}
                size="md"
              />
            </CardContent>
          </Card>

          {/* 1. Informations personnelles */}
          <Card className="!py-0 shadow-xl border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                1. Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="civility" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Civilité</Label>
                  <Select
                    value={adherentData.civility}
                    onValueChange={(value) => setAdherentData({ ...adherentData, civility: value })}
                  >
                    <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
                  <Label htmlFor="firstname" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Prénom</Label>
                  <Input
                    id="firstname"
                    value={adherentData.firstname}
                    onChange={(e) => setAdherentData({ ...adherentData, firstname: e.target.value })}
                    placeholder="Votre prénom"
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="lastname" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nom de famille</Label>
                  <Input
                    id="lastname"
                    value={adherentData.lastname}
                    onChange={(e) => setAdherentData({ ...adherentData, lastname: e.target.value })}
                    placeholder="Votre nom de famille"
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <Label htmlFor="dateNaissance" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Date de naissance</Label>
                  <Input
                    id="dateNaissance"
                    type="date"
                    value={adherentData.dateNaissance || ""}
                    onChange={(e) => setAdherentData({ ...adherentData, dateNaissance: e.target.value })}
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="datePremiereAdhesion" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Date de première adhésion
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-normal">(optionnel)</span>
                  </Label>
                  <Input
                    id="datePremiereAdhesion"
                    type="date"
                    value={adherentData.datePremiereAdhesion || ""}
                    onChange={(e) => setAdherentData({ ...adherentData, datePremiereAdhesion: e.target.value })}
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Date de votre première adhésion à l'association"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Si vous êtes un ancien adhérent, renseignez votre date de première adhésion pour ne pas payer les frais d'adhésion.
                  </p>
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-200">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userData.email}
                    onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    placeholder="votre@email.com"
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card className="!py-0 shadow-xl border-green-200 dark:border-green-800">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="streetnum" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Numéro de rue</Label>
                  <Input
                    id="streetnum"
                    value={adresseData.streetnum}
                    onChange={(e) => setAdresseData(prev => ({ ...prev, streetnum: e.target.value }))}
                    placeholder="123"
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    disabled={saving}
                  />
                </div>
                <div className="relative z-[15]">
                  <Label htmlFor="street1" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rue</Label>
                  <AddressAutocomplete
                    value={adresseData.street1 || ""}
                    onValueChange={handleAddressChange}
                    placeholder="Tapez une rue (ex: rue de la Paix, Paris)"
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    La sélection remplira automatiquement le code postal, la ville et le pays
                  </p>
                </div>
                <div>
                  <Label htmlFor="street2" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Complément d'adresse</Label>
                  <Input
                    id="street2"
                    value={adresseData.street2}
                    onChange={(e) => setAdresseData({ ...adresseData, street2: e.target.value })}
                    placeholder="Appartement, étage..."
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    disabled={saving}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="codepost" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Code postal</Label>
                  <Input
                    id="codepost"
                    value={adresseData.codepost}
                    onChange={(e) => setAdresseData(prev => ({ ...prev, codepost: e.target.value }))}
                    placeholder="75001"
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    disabled={saving}
                    readOnly={!!adresseData.codepost && /^\d{5}$/.test(adresseData.codepost)}
                  />
                  {adresseData.codepost && /^\d{5}$/.test(adresseData.codepost) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Rempli automatiquement depuis la rue
                    </p>
                  )}
                </div>
                <div className="relative z-[10]">
                  <Label htmlFor="city" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Ville</Label>
                  <CityAutocomplete
                    value={adresseData.city || ""}
                    onValueChange={handleCityChange}
                    countryCode={countryCode}
                    placeholder="Sélectionner une ville..."
                    disabled={saving || !countryCode}
                  />
                </div>
                <div className="relative z-[5]">
                  <Label htmlFor="country" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Pays</Label>
                  <CountryAutocomplete
                    value={adresseData.country || ""}
                    onValueChange={handleCountryChange}
                    onCountryCodeChange={handleCountryCodeChange}
                    placeholder="Sélectionner un pays..."
                    disabled={saving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Téléphones */}
          <Card className="!py-0 shadow-xl border-purple-200 dark:border-purple-800">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5" />
                Téléphones
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              {telephonesData.map((telephone, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Téléphone {index + 1}
                    </h4>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 font-medium">
                        <input
                          type="checkbox"
                          checked={telephone.estPrincipal}
                          onChange={(e) => updateTelephone(index, 'estPrincipal', e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600"
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor={`numero-${index}`} className="text-sm font-semibold text-gray-700 dark:text-gray-200">Numéro</Label>
                      <Input
                        id={`numero-${index}`}
                        value={telephone.numero}
                        onChange={(e) => updateTelephone(index, 'numero', e.target.value)}
                        placeholder="06 12 34 56 78"
                        className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`type-${index}`} className="text-sm font-semibold text-gray-700 dark:text-gray-200">Type</Label>
                      <Select
                        value={telephone.type}
                        onValueChange={(value) => updateTelephone(index, 'type', value)}
                      >
                        <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
                    <Label htmlFor={`description-${index}`} className="text-sm font-semibold text-gray-700 dark:text-gray-200">Description (optionnel)</Label>
                    <Input
                      id={`description-${index}`}
                      value={telephone.description}
                      onChange={(e) => updateTelephone(index, 'description', e.target.value)}
                      placeholder="Ex: Bureau, Domicile..."
                      className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addTelephone}
                className="w-full flex items-center gap-2 border-purple-300 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Plus className="h-4 w-4" />
                Ajouter un téléphone
              </Button>
            </CardContent>
          </Card>

          {/* 2. Type d'adhésion */}
          <Card className="!py-0 shadow-xl border-orange-200 dark:border-orange-800">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5" />
                2. Type d'adhésion
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="typeAdhesion" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Type d'adhésion</Label>
                <Select
                  value={adherentData.typeAdhesion || ""}
                  onValueChange={(value) => setAdherentData({ ...adherentData, typeAdhesion: value })}
                >
                  <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
          <Card className="!py-0 shadow-xl border-pink-200 dark:border-pink-800">
            <CardHeader className="bg-gradient-to-r from-pink-500 to-pink-600 dark:from-pink-600 dark:to-pink-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                3. Informations familiales
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="nombreEnfants" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nombre d'enfants</Label>
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
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              {enfantsData.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Enfants (prénoms et dates de naissance / âges)</Label>
                  {enfantsData.map((enfant, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                        <div>
                          <Label htmlFor={`enfant-prenom-${index}`} className="text-sm font-semibold text-gray-700 dark:text-gray-200">Prénom</Label>
                          <Input
                            id={`enfant-prenom-${index}`}
                            value={enfant.prenom}
                            onChange={(e) => updateEnfant(index, 'prenom', e.target.value)}
                            placeholder="Prénom de l'enfant"
                            className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`enfant-date-${index}`} className="text-sm font-semibold text-gray-700 dark:text-gray-200">Date de naissance</Label>
                          <Input
                            id={`enfant-date-${index}`}
                            type="date"
                            value={enfant.dateNaissance || ""}
                            onChange={(e) => updateEnfant(index, 'dateNaissance', e.target.value)}
                            className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`enfant-age-${index}`} className="text-sm font-semibold text-gray-700 dark:text-gray-200">Âge</Label>
                          <Input
                            id={`enfant-age-${index}`}
                            type="number"
                            min="0"
                            value={enfant.age || ""}
                            onChange={(e) => updateEnfant(index, 'age', parseInt(e.target.value) || undefined)}
                            placeholder="Âge"
                            className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Événements familiaux nécessitant l'assistance de l'association</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="naissance"
                      checked={adherentData.evenementsFamiliaux.includes("Naissance")}
                      onCheckedChange={() => toggleEvenementFamilial("Naissance")}
                    />
                    <Label htmlFor="naissance" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                      Naissance
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mariage-enfant"
                      checked={adherentData.evenementsFamiliaux.includes("MariageEnfant")}
                      onCheckedChange={() => toggleEvenementFamilial("MariageEnfant")}
                    />
                    <Label htmlFor="mariage-enfant" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                      Mariage d'un enfant
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="deces-famille"
                      checked={adherentData.evenementsFamiliaux.includes("DecesFamille")}
                      onCheckedChange={() => toggleEvenementFamilial("DecesFamille")}
                    />
                    <Label htmlFor="deces-famille" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                      Décès dans la famille
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="anniversaire-salle"
                      checked={adherentData.evenementsFamiliaux.includes("AnniversaireSalle")}
                      onCheckedChange={() => toggleEvenementFamilial("AnniversaireSalle")}
                    />
                    <Label htmlFor="anniversaire-salle" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                      Anniversaire organisé en salle
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="autre-evenement"
                      checked={adherentData.evenementsFamiliaux.includes("Autre")}
                      onCheckedChange={() => toggleEvenementFamilial("Autre")}
                    />
                    <Label htmlFor="autre-evenement" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                      Autre
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Informations complémentaires */}
          <Card className="!py-0 shadow-xl border-indigo-200 dark:border-indigo-800">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                4. Informations complémentaires
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="profession" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Profession (optionnel)</Label>
                <Input
                  id="profession"
                  value={adherentData.profession || ""}
                  onChange={(e) => setAdherentData({ ...adherentData, profession: e.target.value })}
                  placeholder="Votre profession"
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="centresInteret" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Centres d'intérêt</Label>
                <Textarea
                  id="centresInteret"
                  value={adherentData.centresInteret || ""}
                  onChange={(e) => setAdherentData({ ...adherentData, centresInteret: e.target.value })}
                  placeholder="Vos centres d'intérêt..."
                  rows={4}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </CardContent>
          </Card>

          {/* 5. Autorisations */}
          <Card className="!py-0 shadow-xl border-teal-200 dark:border-teal-800">
            <CardHeader className="bg-gradient-to-r from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                5. Autorisations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autorisation-image"
                  checked={adherentData.autorisationImage}
                  onCheckedChange={(checked) => setAdherentData({ ...adherentData, autorisationImage: checked as boolean })}
                />
                <Label htmlFor="autorisation-image" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                  J'autorise l'association à utiliser mon image dans le cadre de ses activités.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accepte-communications"
                  checked={adherentData.accepteCommunications}
                  onCheckedChange={(checked) => setAdherentData({ ...adherentData, accepteCommunications: checked as boolean })}
                />
                <Label htmlFor="accepte-communications" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                  J'accepte de recevoir les communications de l'association.
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Mention RGPD */}
          <Card className="border-2 border-blue-300 dark:border-blue-600 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 shadow-lg !py-0">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Info className="h-5 w-5" />
                </div>
                <span>Mention d'information RGPD</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              <p className="text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                Les informations recueillies sur ce formulaire sont enregistrées par l'association afin de gérer les adhésions et d'assurer l'assistance prévue dans les statuts, notamment lors des événements familiaux (naissance, mariage d'un enfant, décès, anniversaire). Les données collectées sont limitées à ce qui est strictement nécessaire. Elles sont destinées exclusivement aux membres du bureau de l'association et ne seront jamais transmises à des tiers sans votre accord. Vous pouvez exercer votre droit d'accès, de rectification ou de suppression de vos données en contactant l'association.
              </p>
            </CardContent>
          </Card>

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/user/profile")}
              className="w-full sm:w-auto px-6"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg px-6"
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
