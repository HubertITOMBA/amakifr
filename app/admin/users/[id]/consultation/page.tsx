"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { getUserByIdForAdmin } from "@/actions/user";
import { UserRole, UserStatus } from "@prisma/client";
import { Calendar, Users, Briefcase, Shield, Mail, Phone, MapPin, Building, CheckCircle2, XCircle, User, Sparkles, FileText, Download } from "lucide-react";
import { adminGeneratePasseport } from "@/actions/passeport";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const getRoleColor = (role: UserRole) => {
  switch (role) {
    case UserRole.ADMIN:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800";
    case UserRole.MEMBRE:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800";
    case UserRole.INVITE:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800";
  }
};

const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case UserRole.ADMIN:
      return "ADMIN";
    case UserRole.MEMBRE:
      return "MEMBRE";
    case UserRole.INVITE:
      return "Invité";
    default:
      return role;
  }
};

const getStatusColor = (status: UserStatus) => {
  switch (status) {
    case UserStatus.Actif:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800";
    case UserStatus.Inactif:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800";
  }
};

const getStatusLabel = (status: UserStatus) => {
  switch (status) {
    case UserStatus.Actif:
      return "Actif";
    case UserStatus.Inactif:
      return "Inactif";
    default:
      return status;
  }
};

const getTypeAdhesionLabel = (type: string | null | undefined) => {
  if (!type) return "—";
  switch (type) {
    case "AdhesionAnnuelle":
      return "Adhésion annuelle";
    case "Renouvellement":
      return "Renouvellement";
    case "Autre":
      return "Autre";
    default:
      return type;
  }
};

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "—";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getEvenementFamilialLabel = (type: string) => {
  switch (type) {
    case "Naissance":
      return "Naissance";
    case "MariageEnfant":
      return "Mariage d'un enfant";
    case "DecesFamille":
      return "Décès dans la famille";
    case "AnniversaireSalle":
      return "Anniversaire organisé en salle";
    case "Autre":
      return "Autre";
    default:
      return type;
  }
};

export default function ConsultationUserPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPasseport, setGeneratingPasseport] = useState(false);

  useEffect(() => {
    if (id) {
      loadUser();
    }
  }, [id]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const result = await getUserByIdForAdmin(id);
      if (result.success && result.user) {
        setUser(result.user);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePasseport = async () => {
    if (!id) return;
    
    try {
      setGeneratingPasseport(true);
      const formData = new FormData();
      formData.append("userId", id);
      
      const result = await adminGeneratePasseport(formData);
      
      if (result.success) {
        toast.success(result.message || "Passeport généré avec succès");
        // Recharger les données utilisateur pour afficher le nouveau numéro de passeport
        await loadUser();
      } else {
        toast.error(result.error || "Erreur lors de la génération du passeport");
      }
    } catch (error) {
      console.error("Erreur lors de la génération du passeport:", error);
      toast.error("Erreur lors de la génération du passeport");
    } finally {
      setGeneratingPasseport(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Détails de l'utilisateur" confirmOnClose={false}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Chargement des données...</p>
          </div>
        </div>
      </Modal>
    );
  }

  if (!user) {
    return (
      <Modal title="Détails de l'utilisateur" confirmOnClose={false}>
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Utilisateur introuvable</p>
        </div>
      </Modal>
    );
  }

  const fullName = user.adherent 
    ? `${user.adherent.civility || ''} ${user.adherent.firstname || ''} ${user.adherent.lastname || ''}`.trim()
    : user.name || "Sans nom";

  const adherent = user.adherent;
  const adresse = adherent?.Adresse?.[0];
  const evenementsFamiliaux = adherent?.evenementsFamiliaux 
    ? (typeof adherent.evenementsFamiliaux === 'string' 
        ? JSON.parse(adherent.evenementsFamiliaux) 
        : adherent.evenementsFamiliaux)
    : [];

  return (
    <Modal title="Détails de l'utilisateur" confirmOnClose={false}>
      <div className="space-y-3 sm:space-y-4 max-h-[85vh] overflow-y-auto px-1">
        {/* Header avec nom et badges */}
        <Card className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/20 dark:via-slate-900 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow-md !py-0">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg py-3 px-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-white/30 shadow-lg flex-shrink-0">
                  <AvatarImage 
                    src={user.image || undefined} 
                    alt={fullName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-white/20 text-white text-lg sm:text-xl font-bold">
                    {fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || "U"}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User className="h-5 w-5" />
                  {fullName}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${getRoleColor(user.role)} border text-xs px-2 py-0.5`}>
                  {getRoleLabel(user.role)}
                </Badge>
                <Badge className={`${getStatusColor(user.status)} border text-xs px-2 py-0.5`}>
                  {getStatusLabel(user.status)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3 px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Email</Label>
                  <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{user.email || "—"}</div>
                </div>
              </div>
              {user.createdAt && (
                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <Calendar className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Inscription</Label>
                    <div className="text-xs font-medium text-gray-900 dark:text-white">{formatDate(user.createdAt)}</div>
                  </div>
                </div>
              )}
              {user.lastLogin && (
                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Dernière connexion</Label>
                    <div className="text-xs font-medium text-gray-900 dark:text-white">{formatDate(user.lastLogin)}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {adherent && (
          <>
            {/* 1. Informations personnelles */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>1. Informations personnelles</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Civilité</Label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">{adherent.civility || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Prénom</Label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">{adherent.firstname || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Nom de famille</Label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">{adherent.lastname || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Date de naissance</Label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-gray-400 dark:text-slate-400" />
                      {adherent.dateNaissance ? formatDate(adherent.dateNaissance) : "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Adresse */}
            {adresse && (
              <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span>Adresse</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {adresse.street1 && (
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Adresse complète</Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                          {adresse.streetnum && `${adresse.streetnum} `}
                          {adresse.street1}
                          {adresse.street2 && `, ${adresse.street2}`}
                        </div>
                      </div>
                    )}
                    {(adresse.codepost || adresse.city) && (
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Code postal / Ville</Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                          {adresse.codepost} {adresse.city}
                        </div>
                      </div>
                    )}
                    {adresse.country && (
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Pays</Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">{adresse.country}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Téléphones */}
            {adherent.Telephones && adherent.Telephones.length > 0 && (
              <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span>Téléphones</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="space-y-2">
                    {adherent.Telephones.map((tel: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{tel.numero}</span>
                              {tel.estPrincipal && (
                                <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 dark:text-blue-300 px-1 py-0">Principal</Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              {tel.type} {tel.description && `• ${tel.description}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Passeport Adhérent */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <div className="">
                    <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span>Passeport Adhérent</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {adherent.numeroPasseport ? (
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="p-1.5 sm: flex-shrink-0">
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Numéro de passeport</Label>
                            <div className="text-base sm:text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1 break-all">
                              {adherent.numeroPasseport}
                            </div>
                            {adherent.dateGenerationPasseport && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                                Généré le {formatDate(adherent.dateGenerationPasseport)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleGeneratePasseport}
                        disabled={generatingPasseport || user.status !== "Actif"}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10 px-4"
                      >
                        {generatingPasseport ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            <span className="text-xs sm:text-sm">Génération en cours...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            <span className="text-xs sm:text-sm">Régénérer le passeport</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="p-1.5 sm: flex-shrink-0">
                          <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">Aucun passeport généré</Label>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                            {user.status === "Actif" 
                              ? "Le passeport peut être généré manuellement ou sera généré automatiquement lors de la validation du compte."
                              : "Le compte doit être actif pour générer le passeport."}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleGeneratePasseport}
                        disabled={generatingPasseport || user.status !== "Actif"}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm h-9 sm:h-10 px-4"
                      >
                        {generatingPasseport ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            <span className="text-xs sm:text-sm">Génération en cours...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            <span className="text-xs sm:text-sm">Générer le passeport</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Type d'adhésion */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <div className="">
                    <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span>2. Type d'adhésion</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">Type d'adhésion</Label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                      {getTypeAdhesionLabel(adherent.typeAdhesion)}
                    </div>
                  </div>
                  {adherent.PosteTemplate && (
                    <div className="space-y-1">
                      <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                        <Briefcase className="h-3 w-3" />
                        Poste
                      </Label>
                      <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                        {adherent.PosteTemplate.libelle}
                        {adherent.PosteTemplate.description && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            {adherent.PosteTemplate.description}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. Informations familiales */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <div className="">
                    <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <span>3. Informations familiales</span>
                </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 px-3 sm:px-4 pb-3 sm:pb-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nombre d'enfants</Label>
                  <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md w-fit">
                    {adherent.nombreEnfants || 0}
                  </div>
                </div>

                {adherent.Enfants && adherent.Enfants.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Enfants</Label>
                    <div className="space-y-2">
                      {adherent.Enfants.map((enfant: any, idx: number) => (
                        <div key={idx} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="">
                                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-gray-900 dark:text-white">{enfant.prenom}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {enfant.dateNaissance && formatDate(enfant.dateNaissance)}
                                  {enfant.age && ` (${enfant.age} ans)`}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {evenementsFamiliaux.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Événements familiaux nécessitant l'assistance</Label>
                    <div className="space-y-2">
                      {evenementsFamiliaux.map((type: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{getEvenementFamilialLabel(type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. Informations complémentaires */}
            {(adherent.profession || adherent.centresInteret) && (
              <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <div className="">
                      <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span>4. Informations complémentaires</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {adherent.profession && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Profession</Label>
                        <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">{adherent.profession}</div>
                      </div>
                    )}
                    {adherent.centresInteret && (
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Centres d'intérêt</Label>
                        <div className="text-sm font-medium text-gray-900 dark:text-white p-3 bg-gray-50 dark:bg-gray-800 rounded-md whitespace-pre-wrap">{adherent.centresInteret}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5. Autorisations */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-2 pt-2 px-3 sm:px-4 gap-0">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <div className="">
                    <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span>5. Autorisations</span>
                </CardTitle>
              </CardHeader>
                <CardContent className="pt-2 px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="space-y-3">
                    <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                    adherent.autorisationImage 
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}>
                    {adherent.autorisationImage ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    <Label className="font-normal text-sm text-gray-900 dark:text-white cursor-default">
                      Autorisation d'utilisation de l'image dans le cadre des activités de l'association
                    </Label>
                  </div>
                  <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                    adherent.accepteCommunications !== false 
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}>
                    {adherent.accepteCommunications !== false ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    <Label className="font-normal text-sm text-gray-900 dark:text-white cursor-default">
                      Acceptation des communications de l'association
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!adherent && (
          <Card className="shadow-md border-gray-200 dark:border-gray-700 !py-0">
            <CardContent className="py-12">
              <div className="text-center">
                <User className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">Cet utilisateur n'a pas encore complété ses informations d'adhérent.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Modal>
  );
}
