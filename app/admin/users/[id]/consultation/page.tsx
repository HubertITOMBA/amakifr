"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { getUserByIdForAdmin } from "@/actions/user";
import { UserRole, UserStatus } from "@prisma/client";
import { Calendar, Users, Briefcase, Shield, Mail, Phone, MapPin, Building, CheckCircle2, XCircle, User, Sparkles } from "lucide-react";

const getRoleColor = (role: UserRole) => {
  switch (role) {
    case UserRole.Admin:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800";
    case UserRole.Membre:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800";
    case UserRole.Invite:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800";
  }
};

const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case UserRole.Admin:
      return "Admin";
    case UserRole.Membre:
      return "Membre";
    case UserRole.Invite:
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
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

const getEvenementFamilialLabel = (type: string) => {
  switch (type) {
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
      <div className="space-y-6 max-h-[85vh] overflow-y-auto px-1">
        {/* Header avec nom et badges */}
        <Card className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/20 dark:via-slate-900 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow-lg !py-0">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="relative">
                  <div className="absolute inset-0 animate-pulse opacity-20">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <User className="h-6 w-6 relative" />
                </div>
                {fullName}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={`${getRoleColor(user.role)} border text-xs px-3 py-1`}>
                  {getRoleLabel(user.role)}
                </Badge>
                <Badge className={`${getStatusColor(user.status)} border text-xs px-3 py-1`}>
                  {getStatusLabel(user.status)}
                </Badge>
              </div>
            </div>
          </CardHeader>
                <CardContent className="pt-0 px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Email</Label>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{user.email || "—"}</div>
                </div>
              </div>
              {user.createdAt && (
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Inscription</Label>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(user.createdAt)}</div>
                  </div>
                </div>
              )}
              {user.lastLogin && (
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Dernière connexion</Label>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(user.lastLogin)}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {adherent && (
          <>
            {/* 1. Informations personnelles */}
            <Card className="shadow-md hover:shadow-lg transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span>1. Informations personnelles</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Civilité</Label>
                    <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">{adherent.civility || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Prénom</Label>
                    <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">{adherent.firstname || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nom de famille</Label>
                    <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">{adherent.lastname || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date de naissance</Label>
                    <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {adherent.dateNaissance ? formatDate(adherent.dateNaissance) : "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Adresse */}
            {adresse && (
              <Card className="shadow-md hover:shadow-lg transition-shadow border-gray-200 dark:border-gray-700 !py-0">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 pt-4 px-6 gap-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Adresse</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-6 pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {adresse.street1 && (
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Adresse complète</Label>
                        <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                          {adresse.streetnum && `${adresse.streetnum} `}
                          {adresse.street1}
                          {adresse.street2 && `, ${adresse.street2}`}
                        </div>
                      </div>
                    )}
                    {(adresse.codepost || adresse.city) && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Code postal / Ville</Label>
                        <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                          {adresse.codepost} {adresse.city}
                        </div>
                      </div>
                    )}
                    {adresse.country && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pays</Label>
                        <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">{adresse.country}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Téléphones */}
            {adherent.Telephones && adherent.Telephones.length > 0 && (
              <Card className="shadow-md hover:shadow-lg transition-shadow border-gray-200 dark:border-gray-700 !py-0">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 pt-4 px-6 gap-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Phone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span>Téléphones</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-6 pb-6">
                  <div className="space-y-3">
                    {adherent.Telephones.map((tel: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{tel.numero}</span>
                              {tel.estPrincipal && (
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-300">Principal</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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

            {/* 2. Type d'adhésion */}
            <Card className="shadow-md hover:shadow-lg transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span>2. Type d'adhésion</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-6 pb-6">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type d'adhésion</Label>
                  <div className="text-sm font-medium text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    {getTypeAdhesionLabel(adherent.typeAdhesion)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Informations familiales */}
            <Card className="shadow-md hover:shadow-lg transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                    <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <span>3. Informations familiales</span>
                </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-6 pb-6 space-y-4">
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
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
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
              <Card className="shadow-md hover:shadow-lg transition-shadow border-gray-200 dark:border-gray-700 !py-0">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 pt-4 px-6 gap-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span>4. Informations complémentaires</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-6 pb-6">
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
            <Card className="shadow-md hover:shadow-lg transition-shadow border-gray-200 dark:border-gray-700 !py-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span>5. Autorisations</span>
                </CardTitle>
              </CardHeader>
                <CardContent className="pt-0 px-6 pb-6">
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
