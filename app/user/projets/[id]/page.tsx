"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, FolderKanban, ArrowLeft, Users, MessageSquare, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { getProjetByIdForUser } from "@/actions/projets";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const getStatutBadgeColor = (statut: string) => {
  switch (statut) {
    case "Planifie":
    case "APlanifier":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    case "EnCours":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "EnPause":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "Termine":
    case "Terminee":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
    case "Annule":
    case "Annulee":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
    case "EnAttente":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
};

export default function UserProjetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projetId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [projet, setProjet] = useState<any>(null);

  const loadProjet = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProjetByIdForUser(projetId);
      if (result.success && result.data) {
        setProjet(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement du projet");
        router.push("/user/projets");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement du projet");
      router.push("/user/projets");
    } finally {
      setLoading(false);
    }
  }, [projetId, router]);

  useEffect(() => {
    if (projetId) loadProjet();
  }, [projetId, loadProjet]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!projet) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-gray-700 !pt-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white !pt-0 rounded-t-lg">
            <div className="flex items-center justify-between pt-4 sm:pt-6 pb-4 sm:pb-6">
              <div className="flex items-center gap-4">
                <Link href="/user/projets">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                </Link>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  {projet.titre}
                </CardTitle>
                <Badge className={getStatutBadgeColor(projet.statut)}>
                  {projet.statut}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-6">
            {/* Description */}
            <Card className="!py-0 border-blue-200 dark:border-blue-800">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {projet.description}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  {projet.dateDebut && (
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date de début
                      </Label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                        {format(new Date(projet.dateDebut), "dd/MM/yyyy", { locale: fr })}
                      </p>
                    </div>
                  )}
                  {projet.dateFin && (
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date de fin prévue
                      </Label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                        {format(new Date(projet.dateFin), "dd/MM/yyyy", { locale: fr })}
                      </p>
                    </div>
                  )}
                  {projet.dateFinReelle && (
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Date de fin réelle
                      </Label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                        {format(new Date(projet.dateFinReelle), "dd/MM/yyyy", { locale: fr })}
                      </p>
                    </div>
                  )}
                </div>
                {projet.CreatedBy && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Créé par : {projet.CreatedBy.name || projet.CreatedBy.email || "—"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tâches (lecture seule) */}
            <Card className="!py-0 border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Tâches ({projet.SousProjets?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {projet.SousProjets && projet.SousProjets.length > 0 ? (
                  <div className="space-y-4">
                    {projet.SousProjets.map((sousProjet: any) => (
                      <Card key={sousProjet.id} className="border-gray-200 dark:border-gray-700">
                        <CardHeader className="pb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-sm font-semibold">
                                {sousProjet.titre}
                              </CardTitle>
                              <Badge className={getStatutBadgeColor(sousProjet.statut)}>
                                {sousProjet.statut}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              {sousProjet.description}
                            </p>
                            {(sousProjet.dateDebut || sousProjet.dateFin) && (
                              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                {sousProjet.dateDebut && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Début : {format(new Date(sousProjet.dateDebut), "dd/MM/yyyy", { locale: fr })}
                                  </span>
                                )}
                                {sousProjet.dateFin && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Fin : {format(new Date(sousProjet.dateFin), "dd/MM/yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          {/* Adhérents affectés (lecture seule) */}
                          {sousProjet.Affectations && sousProjet.Affectations.length > 0 && (
                            <div>
                              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-2">
                                <Users className="h-3 w-3" />
                                Adhérents affectés ({sousProjet.Affectations.length})
                              </Label>
                              <div className="flex flex-wrap gap-2">
                                {sousProjet.Affectations.map((affectation: any) => (
                                  <Badge key={affectation.id} variant="outline" className="font-normal">
                                    {affectation.Adherent?.firstname} {affectation.Adherent?.lastname}
                                    {affectation.responsable && (
                                      <span className="text-xs ml-1">(Responsable)</span>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Commentaires (lecture seule) */}
                          {sousProjet.Commentaires && sousProjet.Commentaires.length > 0 && (
                            <div>
                              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-2">
                                <MessageSquare className="h-3 w-3" />
                                Commentaires ({sousProjet.Commentaires.length})
                              </Label>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {sousProjet.Commentaires.map((commentaire: any) => (
                                  <div
                                    key={commentaire.id}
                                    className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">
                                        {commentaire.Adherent?.firstname} {commentaire.Adherent?.lastname}
                                      </span>
                                      <span className="text-gray-500">
                                        {format(new Date(commentaire.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                                      </span>
                                    </div>
                                    <p className="text-gray-700 dark:text-gray-300">{commentaire.contenu}</p>
                                    {commentaire.pourcentageAvancement != null && (
                                      <div className="mt-2">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span>Avancement</span>
                                          <span className="font-semibold">{commentaire.pourcentageAvancement} %</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                          <div
                                            className="bg-blue-600 h-2 rounded-full"
                                            style={{ width: `${commentaire.pourcentageAvancement}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Aucune tâche pour ce projet</p>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
