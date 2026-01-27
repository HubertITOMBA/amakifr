"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Lightbulb, 
  MessageSquare, 
  ThumbsUp, 
  Calendar,
  User,
  Search,
  Plus,
  Send,
  X,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { 
  getAllIdees, 
  createCommentaire, 
  toggleApprobation
} from "@/actions/idees";
import { useCurrentUser } from "@/hooks/use-current-user";
import { StatutIdee } from "@prisma/client";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface IdeeWithRelations {
  id: string;
  titre: string;
  description: string;
  statut: StatutIdee;
  nombreCommentaires: number;
  nombreApprobations: number;
  dateCreation: Date;
  Adherent: {
    id: string;
    firstname: string;
    lastname: string;
    User: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  };
  Commentaires: Array<{
    id: string;
    contenu: string;
    createdAt: Date;
    Adherent: {
      id: string;
      firstname: string;
      lastname: string;
      User: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      };
    };
  }>;
  Approbations: Array<{
    id: string;
    adherentId: string;
    Adherent: {
      User: {
        id: string;
      };
    };
  }>;
}

export default function IdeesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [idees, setIdees] = useState<IdeeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIdee, setSelectedIdee] = useState<IdeeWithRelations | null>(null);
  const [showCommentForm, setShowCommentForm] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [expandedIdees, setExpandedIdees] = useState<Set<string>>(new Set());
  
  // Filtres
  const [auteurFilter, setAuteurFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadIdees();
  }, []);

  const loadIdees = async () => {
    try {
      setLoading(true);
      const result = await getAllIdees();
      if (result.success && result.data) {
        setIdees(result.data as IdeeWithRelations[]);
      } else {
        toast.error(result.error || "Erreur lors du chargement des idées");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des idées:", error);
      toast.error("Erreur lors du chargement des idées");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = (ideeId: string) => {
    const newExpanded = new Set(expandedIdees);
    if (newExpanded.has(ideeId)) {
      newExpanded.delete(ideeId);
    } else {
      newExpanded.add(ideeId);
    }
    setExpandedIdees(newExpanded);
  };

  const handleCommentSubmit = async (ideeId: string) => {
    if (!commentContent.trim()) {
      toast.error("Veuillez saisir un commentaire");
      return;
    }

    try {
      setCommentLoading(true);
      const formData = new FormData();
      formData.append("ideeId", ideeId);
      formData.append("contenu", commentContent);

      const result = await createCommentaire(formData);
      if (result.success) {
        toast.success(result.message || "Commentaire ajouté avec succès");
        setCommentContent("");
        setShowCommentForm(null);
        await loadIdees();
      } else {
        toast.error(result.error || "Erreur lors de l'ajout du commentaire");
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du commentaire:", error);
      toast.error("Erreur lors de l'ajout du commentaire");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleToggleApprobation = async (ideeId: string) => {
    try {
      const result = await toggleApprobation(ideeId);
      if (result.success) {
        toast.success(result.message || "Approbation mise à jour");
        await loadIdees();
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour de l'approbation");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'approbation:", error);
      toast.error("Erreur lors de la mise à jour de l'approbation");
    }
  };


  const hasUserApprobation = (idee: IdeeWithRelations) => {
    if (!user?.id) return false;
    return idee.Approbations.some(
      (approbation) => approbation.Adherent.User.id === user.id
    );
  };

  // Liste unique des auteurs
  const auteurs = useMemo(() => {
    const uniqueAuteurs = new Map<string, string>();
    idees.forEach((idee) => {
      const auteurName = `${idee.Adherent.firstname} ${idee.Adherent.lastname}`;
      uniqueAuteurs.set(idee.Adherent.id, auteurName);
    });
    return Array.from(uniqueAuteurs.entries()).map(([id, name]) => ({ id, name }));
  }, [idees]);

  // Filtrer les idées
  const filteredIdees = useMemo(() => {
    return idees.filter((idee) => {
      // Filtre de recherche
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const auteurName = `${idee.Adherent.firstname} ${idee.Adherent.lastname}`.toLowerCase();
        if (
          !idee.titre.toLowerCase().includes(searchLower) &&
          !idee.description.toLowerCase().includes(searchLower) &&
          !auteurName.includes(searchLower)
        ) {
          return false;
        }
      }

      // Filtre par auteur
      if (auteurFilter !== "all" && idee.Adherent.id !== auteurFilter) {
        return false;
      }

      // Filtre par date
      if (dateFilter !== "all") {
        const date = new Date(idee.dateCreation);
        switch (dateFilter) {
          case "today":
            if (!isToday(date)) return false;
            break;
          case "yesterday":
            if (!isYesterday(date)) return false;
            break;
          case "thisWeek":
            if (!isThisWeek(date)) return false;
            break;
          case "thisMonth":
            if (!isThisMonth(date)) return false;
            break;
          case "older":
            if (isThisMonth(date)) return false;
            break;
        }
      }

      return true;
    });
  }, [idees, searchTerm, auteurFilter, dateFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <DynamicNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-700 dark:text-gray-300">Chargement des idées...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <DynamicNavbar />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        {/* Header avec gradient professionnel */}
        <div className="mb-6 sm:mb-8">
          <Card className="border-0 shadow-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 rounded-lg shadow-md">
                    <Lightbulb className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                      Boîte à idées
                      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 animate-pulse" />
                    </CardTitle>
                    <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm md:text-base">
                      Partagez vos idées et contribuez à l'association
                    </p>
                  </div>
                </div>
                {user && (
                  <Link href="/user/profile" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600 border-0 shadow-lg hover:shadow-xl transition-all">
                      <Plus className="h-4 w-4 mr-2" />
                      Proposer une idée
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Barre de recherche et filtres */}
        <Card className="mb-6 shadow-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                <Input
                  placeholder="Rechercher une idée par titre, description ou auteur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>

              {/* Bouton pour afficher/masquer les filtres */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="border-slate-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtres avancés
                  {showFilters ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </Button>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredIdees.length} idée{filteredIdees.length !== 1 ? "s" : ""} trouvée{filteredIdees.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Filtres avancés */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2">
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                      Auteur / Adhérent
                    </Label>
                    <Select value={auteurFilter} onValueChange={setAuteurFilter}>
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                        <SelectValue placeholder="Tous les auteurs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="auteur-all" value="all">Tous les auteurs</SelectItem>
                        {auteurs.map((auteur) => (
                          <SelectItem key={auteur.id} value={auteur.id}>
                            {auteur.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                      Date
                    </Label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                        <SelectValue placeholder="Toutes les dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="date-all" value="all">Toutes les dates</SelectItem>
                        <SelectItem key="date-today" value="today">Aujourd'hui</SelectItem>
                        <SelectItem key="date-yesterday" value="yesterday">Hier</SelectItem>
                        <SelectItem key="date-thisweek" value="thisWeek">Cette semaine</SelectItem>
                        <SelectItem key="date-thismonth" value="thisMonth">Ce mois</SelectItem>
                        <SelectItem key="date-older" value="older">Plus ancien</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Liste des idées */}
        <div className="space-y-4 sm:space-y-6">
          {filteredIdees.length === 0 ? (
            <Card className="shadow-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <CardContent className="py-16 text-center">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <Lightbulb className="h-10 w-10 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {searchTerm || auteurFilter !== "all" || dateFilter !== "all"
                    ? "Aucune idée ne correspond aux critères"
                    : "Aucune idée validée pour le moment"}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {searchTerm || auteurFilter !== "all" || dateFilter !== "all"
                    ? "Essayez de modifier vos filtres de recherche"
                    : "Aucune idée n'a encore été validée par l'administration."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredIdees.map((idee) => {
              const isExpanded = expandedIdees.has(idee.id);
              const hasApprobation = hasUserApprobation(idee);
              // Toutes les idées affichées sont validées, donc on peut toujours commenter
              const canComment = true;

              // Formatage de la date
              const dateCreation = new Date(idee.dateCreation);
              let dateFormatted = "";
              if (isToday(dateCreation)) {
                dateFormatted = "Aujourd'hui";
              } else if (isYesterday(dateCreation)) {
                dateFormatted = "Hier";
              } else if (isThisWeek(dateCreation)) {
                dateFormatted = format(dateCreation, "EEEE", { locale: fr });
              } else {
                dateFormatted = format(dateCreation, "d MMMM yyyy", { locale: fr });
              }

              return (
                <Card 
                  key={idee.id} 
                  className="shadow-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-xl transition-all duration-300 overflow-hidden group !py-0"
                >
                  <CardHeader className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-700 dark:via-blue-800 dark:to-indigo-800 text-white pb-4 pt-4 px-4 sm:px-6 gap-0 mt-0">
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <CardTitle className="text-lg sm:text-xl font-bold mb-2 text-white leading-tight">
                          {idee.titre}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-blue-100 dark:text-blue-200 overflow-x-auto -mx-1 sm:mx-0 px-1 sm:px-0">
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-white/10 dark:bg-white/5 px-2 py-1 rounded-md backdrop-blur-sm whitespace-nowrap flex-shrink-0">
                            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="font-medium truncate max-w-[120px] sm:max-w-none">
                              {idee.Adherent.firstname} {idee.Adherent.lastname}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-white/10 dark:bg-white/5 px-2 py-1 rounded-md backdrop-blur-sm whitespace-nowrap flex-shrink-0">
                            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span>{dateFormatted}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 bg-white dark:bg-slate-800">
                    <p className="text-gray-800 dark:text-gray-200 mb-6 whitespace-pre-wrap leading-relaxed text-base">
                      {idee.description}
                    </p>

                    {/* Stats avec meilleur contraste */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-slate-200 dark:border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleApprobation(idee.id)}
                        className={`transition-all flex-1 sm:flex-initial ${
                          hasApprobation 
                            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300" 
                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                        disabled={!canComment}
                        title={!canComment ? "Seules les idées validées peuvent être approuvées" : ""}
                      >
                        <ThumbsUp className={`h-4 w-4 mr-2 ${hasApprobation ? "fill-current" : ""}`} />
                        <span className="font-semibold text-sm sm:text-base">{idee.nombreApprobations}</span>
                        <span className="ml-1 text-xs sm:text-sm hidden sm:inline">approbation{idee.nombreApprobations !== 1 ? "s" : ""}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleExpand(idee.id)}
                        className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex-1 sm:flex-initial"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        <span className="font-semibold text-sm sm:text-base">{idee.nombreCommentaires}</span>
                        <span className="ml-1 text-xs sm:text-sm hidden sm:inline">commentaire{idee.nombreCommentaires !== 1 ? "s" : ""}</span>
                      </Button>
                    </div>

                    {/* Commentaires (expandable) */}
                    {isExpanded && (
                      <div className="space-y-4 animate-in slide-in-from-top-2">
                        {/* Liste des commentaires */}
                        {idee.Commentaires.length > 0 ? (
                          <div className="space-y-3">
                            {idee.Commentaires.map((commentaire) => (
                              <div
                                key={commentaire.id}
                                className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-700 shadow-sm">
                                    <AvatarImage
                                      src={commentaire.Adherent.User.image || undefined}
                                    />
                                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold">
                                      {commentaire.Adherent.firstname[0]}
                                      {commentaire.Adherent.lastname[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                        {commentaire.Adherent.firstname} {commentaire.Adherent.lastname}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {format(
                                          new Date(commentaire.createdAt),
                                          "d MMM yyyy à HH:mm",
                                          { locale: fr }
                                        )}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                      {commentaire.contenu}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <MessageSquare className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Aucun commentaire pour le moment
                            </p>
                          </div>
                        )}

                        {/* Formulaire de commentaire */}
                        {canComment && user && (
                          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                            {showCommentForm === idee.id ? (
                              <div className="space-y-3">
                                <Label htmlFor={`comment-${idee.id}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  Ajouter un commentaire
                                </Label>
                                <p className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                                  Seules les idées validées par l'administration peuvent être commentées.
                                </p>
                                <Textarea
                                  id={`comment-${idee.id}`}
                                  placeholder="Votre commentaire..."
                                  value={commentContent}
                                  onChange={(e) => setCommentContent(e.target.value)}
                                  rows={4}
                                  className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleCommentSubmit(idee.id)}
                                    disabled={commentLoading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    {commentLoading ? "Envoi..." : "Envoyer"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setShowCommentForm(null);
                                      setCommentContent("");
                                    }}
                                    className="border-slate-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Annuler
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                onClick={() => setShowCommentForm(idee.id)}
                                className="w-full border-slate-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Ajouter un commentaire
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
