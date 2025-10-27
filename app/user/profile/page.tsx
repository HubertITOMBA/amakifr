"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  Settings, 
  Edit,
  Camera,
  CheckCircle,
  Clock,
  Globe,
  Home,
  Building,
  CreditCard,
  Euro,
  Receipt
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserProfile } from "@/hooks/use-user-profile";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { updateUserData } from "@/actions/user";
import { toast } from "sonner";

export default function UserProfilePage() {
  const user = useCurrentUser();
  const { userProfile, loading: profileLoading, error: profileError } = useUserProfile();
  const [currentImage, setCurrentImage] = useState(user?.image || "");

  // Synchroniser l'image avec les données utilisateur
  useEffect(() => {
    if (userProfile?.image) {
      setCurrentImage(userProfile.image);
    } else if (user?.image) {
      setCurrentImage(user.image);
    }
  }, [userProfile?.image, user?.image]);

  const handleImageChange = async (imageUrl: string) => {
    setCurrentImage(imageUrl);
    // Mettre à jour l'image dans la base de données
    try {
      const result = await updateUserData(
        {
          ...user,
          image: imageUrl
        },
        {},
        {},
        []
      );

      if (result.success) {
        toast.success("Photo mise à jour avec succès !");
        // Recharger les données du profil pour synchroniser
        window.location.reload();
      } else {
        throw new Error(result.message || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'image:', error);
      toast.error("Erreur lors de la mise à jour de l'image");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300">Veuillez vous connecter pour voir votre profil</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Actif':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Inactif':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Membre':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Invite':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Données par défaut si certaines propriétés ne sont pas disponibles
  const userStatus = (user as any)?.status || 'Actif';
  const userRole = (user as any)?.role || 'Membre';
  const userCreatedAt = (user as any)?.createdAt || new Date().toISOString();
  const userLastLogin = (user as any)?.lastLogin || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <PhotoUpload
                currentImage={currentImage}
                userName={user.name || ""}
                onImageChange={handleImageChange}
                size="lg"
              />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {user.name || "Utilisateur"}
              </h1>
              <p className="text-xl text-blue-100 mb-4">{user.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <Badge className={getStatusColor(userStatus)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {userStatus}
                </Badge>
                <Badge className={getRoleColor(userRole)}>
                  <Shield className="h-4 w-4 mr-1" />
                  {userRole}
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu principal */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Informations personnelles */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Informations de base */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Informations Personnelles
                  </CardTitle>
                  <CardDescription>
                    Vos informations de base et de contact
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{user.email || "Non renseigné"}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Nom complet</p>
                        <p className="font-medium">
                          {user.name || "Non renseigné"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Membre depuis</p>
                        <p className="font-medium">
                          {new Date(userCreatedAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Dernière connexion</p>
                        <p className="font-medium">
                          {userLastLogin ? 
                            new Date(userLastLogin).toLocaleDateString('fr-FR') :
                            "Jamais"
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Informations Adhérent */}
              {profileLoading ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Informations Adhérent
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : userProfile?.adherent ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Informations Adhérent
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Civilité</span>
                      <span className="font-medium">{userProfile.adherent.civility || "Non renseigné"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Prénom</span>
                      <span className="font-medium">{userProfile.adherent.firstname}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Nom</span>
                      <span className="font-medium">{userProfile.adherent.lastname}</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Informations Adhérent
                    </CardTitle>
                    <CardDescription>
                      Aucune information d'adhérent disponible
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">
                        Complétez vos informations d'adhérent
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Informations d'Adresse */}
              {profileLoading ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Adresse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : userProfile?.adherent?.Adresse && userProfile.adherent.Adresse.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Adresse
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {userProfile.adherent.Adresse.map((adresse, index) => (
                      <div key={adresse.id} className="space-y-2">
                        {index > 0 && <hr className="my-4" />}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Numéro</span>
                          <span className="font-medium">{adresse.streetnum || "Non renseigné"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Rue</span>
                          <span className="font-medium">{adresse.street1 || "Non renseigné"}</span>
                        </div>
                        {adresse.street2 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">Complément</span>
                            <span className="font-medium">{adresse.street2}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Code postal</span>
                          <span className="font-medium">{adresse.codepost || "Non renseigné"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Ville</span>
                          <span className="font-medium">{adresse.city || "Non renseigné"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Pays</span>
                          <span className="font-medium">{adresse.country || "Non renseigné"}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Adresse
                    </CardTitle>
                    <CardDescription>
                      Aucune adresse enregistrée
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">
                        Ajoutez votre adresse
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Informations des Téléphones */}
              {profileLoading ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Téléphones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : userProfile?.adherent?.Telephones && userProfile.adherent.Telephones.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Téléphones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {userProfile.adherent.Telephones.map((telephone, index) => (
                      <div key={telephone.id} className="space-y-2">
                        {index > 0 && <hr className="my-4" />}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Numéro</span>
                          <span className="font-medium">{telephone.numero}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Type</span>
                          <Badge variant="outline" className="text-xs">
                            {telephone.type}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Principal</span>
                          <span className="font-medium">
                            {telephone.estPrincipal ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-400" />
                            )}
                          </span>
                        </div>
                        {telephone.description && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">Description</span>
                            <span className="font-medium text-sm">{telephone.description}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Téléphones
                    </CardTitle>
                    <CardDescription>
                      Aucun numéro de téléphone enregistré
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">
                        Ajoutez vos numéros de téléphone
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Informations des Cotisations */}
              {profileLoading ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Cotisations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : userProfile?.adherent?.Cotisations && userProfile.adherent.Cotisations.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Cotisations Payées
                    </CardTitle>
                    <CardDescription>
                      Historique de vos cotisations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {userProfile.adherent.Cotisations.map((cotisation, index) => (
                      <div key={cotisation.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {cotisation.type}
                            </Badge>
                            <Badge 
                              className={`text-xs ${
                                cotisation.statut === 'Valide' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : cotisation.statut === 'EnAttente'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}
                            >
                              {cotisation.statut}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                            <Euro className="h-4 w-4" />
                            {cotisation.montant}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-300">Date:</span>
                            <span className="ml-2 font-medium">
                              {new Date(cotisation.dateCotisation).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-300">Paiement:</span>
                            <span className="ml-2 font-medium">{cotisation.moyenPaiement}</span>
                          </div>
                        </div>
                        {cotisation.description && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-300">Description:</span>
                            <span className="ml-2">{cotisation.description}</span>
                          </div>
                        )}
                        {cotisation.reference && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-300">Référence:</span>
                            <span className="ml-2 font-mono text-xs">{cotisation.reference}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Cotisations
                    </CardTitle>
                    <CardDescription>
                      Aucune cotisation enregistrée
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">
                        Vos cotisations apparaîtront ici
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Obligations de Cotisation */}
              {profileLoading ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Obligations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : userProfile?.adherent?.ObligationsCotisation && userProfile.adherent.ObligationsCotisation.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Obligations de Cotisation
                    </CardTitle>
                    <CardDescription>
                      Vos obligations et montants restants
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {userProfile.adherent.ObligationsCotisation.map((obligation, index) => (
                      <div key={obligation.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {obligation.type}
                            </Badge>
                            <Badge 
                              className={`text-xs ${
                                obligation.statut === 'Paye' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : obligation.statut === 'PartiellementPaye'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : obligation.statut === 'EnRetard'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}
                            >
                              {obligation.statut}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              Restant: <span className="font-bold text-red-600">
                                <Euro className="h-3 w-3 inline mr-1" />
                                {obligation.montantRestant}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-300">Attendu:</span>
                            <span className="ml-2 font-medium">
                              <Euro className="h-3 w-3 inline mr-1" />
                              {obligation.montantAttendu}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-300">Payé:</span>
                            <span className="ml-2 font-medium text-green-600">
                              <Euro className="h-3 w-3 inline mr-1" />
                              {obligation.montantPaye}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Échéance:</span>
                          <span className="ml-2 font-medium">
                            {new Date(obligation.dateEcheance).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-300">Période:</span>
                          <span className="ml-2 font-medium">{obligation.periode}</span>
                        </div>
                        {obligation.description && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-300">Description:</span>
                            <span className="ml-2">{obligation.description}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Obligations
                    </CardTitle>
                    <CardDescription>
                      Aucune obligation enregistrée
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">
                        Vos obligations apparaîtront ici
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Statut du compte */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Statut du Compte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Statut</span>
                    <Badge className={getStatusColor(userStatus)}>
                      {userStatus}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Rôle</span>
                    <Badge className={getRoleColor(userRole)}>
                      {userRole}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">ID Utilisateur</span>
                    <span className="text-sm font-medium font-mono">
                      {user.id?.slice(0, 8) || "Non disponible"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Image de profil</span>
                    <span className="text-sm font-medium">
                      {user.image ? "Définie" : "Non définie"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Actions rapides */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Actions Rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier le profil
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Paramètres
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Sécurité
                  </Button>
                </CardContent>
              </Card>

              {/* Informations système */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informations Système</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">ID Utilisateur</span>
                    <span className="font-mono text-xs">{user.id?.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Créé le</span>
                    <span>{new Date(userCreatedAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Email vérifié</span>
                    <span>{user.email ? "Oui" : "Non"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Section Actions */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Gérer vos informations
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              Mettez à jour vos informations personnelles, d'adhérent et d'adresse
            </p>
            <Link href="/user/update">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                Mettre à jour mes informations
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
