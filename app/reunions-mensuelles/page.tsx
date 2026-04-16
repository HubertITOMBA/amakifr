"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Users,
  Home,
  UtensilsCrossed,
  Building2,
  Plus,
  User,
  Mail,
  Phone,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getAllReunionsMensuelles,
  createReunionMensuelle,
  updateReunionMensuelle,
  validerMoisReunion,
  desisterReunionMensuelle,
  confirmerParticipationReunion,
  getReunionMensuelleById,
} from "@/actions/reunions-mensuelles";
import { StatutReunionMensuelle, TypeLieuReunion, StatutParticipationReunion } from "@prisma/client";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminRole } from "@/lib/utils";
import { InlineAdherentSearchPanel } from "@/components/admin/InlineAdherentSearchPanel";
import { getAdherentsMembres } from "@/actions/cotisations-du-mois";

const moisOptions = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

function dateToUtcNoonIso(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)).toISOString();
}

export default function ReunionsMensuellesPage() {
  const user = useCurrentUser();
  const isAdmin = user?.role ? isAdminRole(user.role) : false;
  const [reunions, setReunions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReunion, setSelectedReunion] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showParticipationDialog, setShowParticipationDialog] = useState(false);
  const [participationStatut, setParticipationStatut] = useState<StatutParticipationReunion>("Present");
  const [participationCommentaire, setParticipationCommentaire] = useState("");
  const [adherentSearchOpen, setAdherentSearchOpen] = useState(false);
  const [selectedAdherentHote, setSelectedAdherentHote] = useState<any | null>(null);
  const [adherentsMembres, setAdherentsMembres] = useState<any[]>([]);
  const [createFormData, setCreateFormData] = useState({
    annee: new Date().getFullYear(),
    mois: new Date().getMonth() + 1,
    adherentHoteId: "",
  });
  const [editFormData, setEditFormData] = useState({
    dateReunion: "",
    typeLieu: "Domicile" as TypeLieuReunion,
    adresse: "",
    nomRestaurant: "",
    commentaires: "",
  });
  const [confirmSelectedDate, setConfirmSelectedDate] = useState<Date | undefined>(undefined);
  const [anneeCartes, setAnneeCartes] = useState(new Date().getFullYear());

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAllReunionsMensuelles();
      if (result.success && result.data) {
        setReunions(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des réunions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isAdmin && showCreateDialog) {
      loadAdherentsMembres();
    }
  }, [isAdmin, showCreateDialog]);

  // Charger l'hôte sélectionné quand les adhérents sont disponibles
  useEffect(() => {
    if (isAdmin && selectedReunion && adherentsMembres.length > 0 && createFormData.adherentHoteId && !selectedAdherentHote) {
      const hote = adherentsMembres.find(a => a.id === createFormData.adherentHoteId);
      if (hote) {
        setSelectedAdherentHote(hote);
      }
    }
  }, [adherentsMembres, createFormData.adherentHoteId, selectedReunion, isAdmin, selectedAdherentHote]);

  const loadAdherentsMembres = async () => {
    try {
      const res = await getAdherentsMembres();
      if (res.success && res.adherents) {
        setAdherentsMembres(res.adherents);
      }
    } catch (err) {
      console.error("Erreur chargement adhérents:", err);
    }
  };

  const handleCreateReunion = async () => {
    setLoading(true);
    try {
      const result = await createReunionMensuelle({
        annee: createFormData.annee,
        mois: createFormData.mois,
        adherentHoteId: isAdmin && createFormData.adherentHoteId ? createFormData.adherentHoteId : undefined,
      });

      if (result.success) {
        toast.success(isAdmin ? "Réunion créée." : "Réunion créée. En attente de validation du mois par l'admin.");
        setShowCreateDialog(false);
        setCreateFormData({
          annee: new Date().getFullYear(),
          mois: new Date().getMonth() + 1,
          adherentHoteId: "",
        });
        setSelectedAdherentHote(null);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      toast.error("Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDate = async () => {
    if (!selectedReunion || !editFormData.dateReunion) {
      toast.error("Veuillez sélectionner une date");
      return;
    }

    setLoading(true);
    try {
      const result = await updateReunionMensuelle({
        id: selectedReunion.id,
        dateReunion: editFormData.dateReunion,
        typeLieu: editFormData.typeLieu,
        adresse: editFormData.adresse,
        nomRestaurant: editFormData.nomRestaurant,
        commentaires: editFormData.commentaires,
      });

      if (result.success) {
        toast.success("Date confirmée ! Les autres adhérents seront notifiés.");
        setSelectedReunion(null);
        setEditFormData({
          dateReunion: "",
          typeLieu: "Domicile",
          adresse: "",
          nomRestaurant: "",
          commentaires: "",
        });
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la confirmation");
      }
    } catch (error) {
      toast.error("Erreur lors de la confirmation");
    } finally {
      setLoading(false);
    }
  };

  const handleValiderMois = async () => {
    if (!selectedReunion) return;
    if (!confirm("Valider le mois choisi par l'adhérent ? L'hôte pourra ensuite choisir la date et recevra un email.")) return;
    setLoading(true);
    try {
      const result = await validerMoisReunion(selectedReunion.id);
      if (result.success) {
        toast.success("Mois validé. L'hôte peut maintenant confirmer la date.");
        setShowCreateDialog(false);
        setSelectedReunion(null);
        setSelectedAdherentHote(null);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la validation");
      }
    } catch (error) {
      toast.error("Erreur lors de la validation");
    } finally {
      setLoading(false);
    }
  };

  const handleDesister = async () => {
    if (!selectedReunion) return;
    if (
      !confirm(
        "Vous vous désister comme hôte pour cette réunion ? Le mois sera à nouveau disponible pour un autre adhérent."
      )
    )
      return;
    setLoading(true);
    try {
      const result = await desisterReunionMensuelle(selectedReunion.id);
      if (result.success) {
        toast.success("Vous vous êtes désisté. Le mois est à nouveau disponible pour un autre adhérent.");
        setShowCreateDialog(false);
        setSelectedReunion(null);
        setSelectedAdherentHote(null);
        loadData();
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (error) {
      toast.error("Erreur lors du désistement");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmParticipation = async () => {
    if (!selectedReunion) return;

    setLoading(true);
    try {
      const result = await confirmerParticipationReunion({
        reunionId: selectedReunion.id,
        statut: participationStatut,
        commentaire: participationCommentaire || undefined,
      });

      if (result.success) {
        toast.success("Participation confirmée");
        setShowParticipationDialog(false);
        setParticipationCommentaire("");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la confirmation");
      }
    } catch (error) {
      toast.error("Erreur lors de la confirmation");
    } finally {
      setLoading(false);
    }
  };

  const openParticipationDialog = async (reunion: any) => {
    setSelectedReunion(reunion);
    const existingParticipation = reunion.Participations?.find(
      (p: any) => p.Adherent?.User?.id === user?.id
    );
    if (existingParticipation) {
      setParticipationStatut(existingParticipation.statut);
      setParticipationCommentaire(existingParticipation.commentaire || "");
    } else {
      setParticipationStatut("Present");
      setParticipationCommentaire("");
    }
    setShowParticipationDialog(true);
  };

  const openEditDialog = async (reunion: any) => {
    setSelectedReunion(reunion);
    setEditFormData({
      dateReunion: reunion.dateReunion ? format(new Date(reunion.dateReunion), "yyyy-MM-dd'T'HH:mm") : "",
      typeLieu: reunion.typeLieu || "Domicile",
      adresse: reunion.adresse || "",
      nomRestaurant: reunion.nomRestaurant || "",
      commentaires: reunion.commentaires || "",
    });
  };

  const getStatutBadge = (statut: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      EnAttente: { label: "En attente de validation", variant: "outline" },
      MoisValide: { label: "Mois validé - Confirmez la date", variant: "secondary" },
      DateConfirmee: { label: "Date confirmée", variant: "default" },
      Annulee: { label: "Annulée", variant: "destructive" },
    };
    return badges[statut] || { label: statut, variant: "outline" };
  };

  const getTypeLieuIcon = (type: string) => {
    switch (type) {
      case "Domicile":
        return <Home className="h-5 w-5" />;
      case "Restaurant":
        return <UtensilsCrossed className="h-5 w-5" />;
      case "Autre":
        return <Building2 className="h-5 w-5" />;
      default:
        return <MapPin className="h-5 w-5" />;
    }
  };

  const getParticipationSubmitLabel = (statut: StatutParticipationReunion) => {
    switch (statut) {
      case "Present":
        return "Confirmer ma présence";
      case "Absent":
        return "Confirmer mon absence";
      case "Excuse":
        return "Envoyer mes excuses";
      default:
        return "Confirmer";
    }
  };

  const isReunionPassee = (reunion: any) => {
    if (!reunion?.dateReunion) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(reunion.dateReunion);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() < now.getTime();
  };

  const getStatutBadgeForReunion = (reunion: any) => {
    const badge = getStatutBadge(reunion?.statut);
    if (reunion?.statut === "DateConfirmee" && isReunionPassee(reunion)) {
      return {
        label: "Réunion passée",
        variant: "secondary" as const,
        className: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
      };
    }
    return { ...badge, className: "" };
  };

  const reunionsParMois = useMemo(() => {
    const map = new Map<number, any>();
    reunions.forEach((r) => {
      if (r.annee === anneeCartes) {
        map.set(r.mois, r);
      }
    });
    return map;
  }, [reunions, anneeCartes]);

  const handleClickMois = async (mois: number) => {
    const reunionExistante = reunionsParMois.get(mois);
    if (reunionExistante) {
      if (isAdmin) {
        // Admin : toujours ouvrir le dialog pour modifier (changer hôte, valider, etc.)
        // Charger les adhérents si nécessaire
        if (adherentsMembres.length === 0) {
          await loadAdherentsMembres();
        }
        setSelectedReunion(reunionExistante);
        setCreateFormData({
          annee: reunionExistante.annee,
          mois: reunionExistante.mois,
          adherentHoteId: reunionExistante.adherentHoteId || "",
        });
        const hote = adherentsMembres.find(a => a.id === reunionExistante.adherentHoteId);
        setSelectedAdherentHote(hote || null);
        setEditFormData({
          dateReunion: reunionExistante.dateReunion ? new Date(reunionExistante.dateReunion).toISOString() : "",
          typeLieu: reunionExistante.typeLieu || "Domicile",
          adresse: reunionExistante.adresse || "",
          nomRestaurant: reunionExistante.nomRestaurant || "",
          commentaires: reunionExistante.commentaires || "",
        });
        setConfirmSelectedDate(reunionExistante.dateReunion ? new Date(reunionExistante.dateReunion) : undefined);
        setShowCreateDialog(true);
      } else {
        // Adhérent : selon le statut
        if (reunionExistante.statut === "DateConfirmee") {
          if (isReunionPassee(reunionExistante)) {
            toast.info("Cette réunion est passée. Vous ne pouvez plus indiquer votre présence.");
            return;
          }
          openParticipationDialog(reunionExistante);
        } else if (reunionExistante.statut === "MoisValide") {
          // Mois validé : ouvrir le dialog avec calendrier pour choisir/modifier la date
          setSelectedReunion(reunionExistante);
          setEditFormData({
            dateReunion: reunionExistante.dateReunion ? new Date(reunionExistante.dateReunion).toISOString() : "",
            typeLieu: reunionExistante.typeLieu || "Domicile",
            adresse: reunionExistante.adresse || "",
            nomRestaurant: reunionExistante.nomRestaurant || "",
            commentaires: reunionExistante.commentaires || "",
          });
          setConfirmSelectedDate(reunionExistante.dateReunion ? new Date(reunionExistante.dateReunion) : undefined);
          setShowCreateDialog(true);
        } else {
          // En attente : ouvrir le dialog pour voir les infos (date non modifiable tant que pas validé)
          setSelectedReunion(reunionExistante);
          setEditFormData({
            dateReunion: reunionExistante.dateReunion ? new Date(reunionExistante.dateReunion).toISOString() : "",
            typeLieu: reunionExistante.typeLieu || "Domicile",
            adresse: reunionExistante.adresse || "",
            nomRestaurant: reunionExistante.nomRestaurant || "",
            commentaires: reunionExistante.commentaires || "",
          });
          setConfirmSelectedDate(reunionExistante.dateReunion ? new Date(reunionExistante.dateReunion) : undefined);
          setShowCreateDialog(true);
        }
      }
      } else {
        // Sinon, ouvrir le dialog pour créer une réunion pour ce mois
        if (isAdmin && adherentsMembres.length === 0) {
          await loadAdherentsMembres();
        }
        setCreateFormData({
          annee: anneeCartes,
          mois: mois,
          adherentHoteId: "",
        });
        setSelectedAdherentHote(null);
        setShowCreateDialog(true);
      }
  };

  const getMoisCardStyle = (mois: number) => {
    const reunion = reunionsParMois.get(mois);
    if (!reunion) {
      return "border-gray-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer";
    }
    switch (reunion.statut) {
      case "DateConfirmee":
        return "border-green-500 bg-green-50 dark:bg-green-950/30 cursor-pointer";
      case "MoisValide":
        return "border-orange-500 bg-orange-50 dark:bg-orange-950/30 cursor-pointer";
      case "EnAttente":
        return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 cursor-pointer";
      default:
        return "border-gray-200 cursor-pointer";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 p-2 sm:p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/user/profile" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        </div>
        <Card className="shadow-lg border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Calendrier des Réunions Mensuelles {anneeCartes}
              </CardTitle>
            </div>
            <CardDescription className="text-blue-100 text-xs pb-3">
              Cliquez sur un mois pour choisir d&apos;être l&apos;hôte, voir les détails ou indiquer votre présence (réunions à date confirmée).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <Label htmlFor="annee-select" className="text-sm font-medium">Année</Label>
                <Input
                  id="annee-select"
                  type="number"
                  min="2020"
                  max="2100"
                  value={anneeCartes}
                  onChange={(e) => setAnneeCartes(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-24"
                />
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {moisOptions.map((mois) => {
                  const reunion = reunionsParMois.get(mois.value);
                  const statutBadge = reunion ? getStatutBadgeForReunion(reunion) : null;
                  
                  return (
                    <Card
                      key={mois.value}
                      className={`border-2 transition-all ${getMoisCardStyle(mois.value)}`}
                      onClick={() => handleClickMois(mois.value)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className={`h-8 w-8 ${reunion ? "text-blue-600" : "text-gray-400"}`} />
                          <h3 className="font-semibold text-lg">{mois.label}</h3>
                          {reunion ? (
                            <>
                              {statutBadge && (
                                <Badge variant={statutBadge.variant} className={`text-xs ${statutBadge.className}`}>
                                  {statutBadge.label}
                                </Badge>
                              )}
                              {reunion.AdherentHote ? (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  Hôte: {reunion.AdherentHote.firstname} {reunion.AdherentHote.lastname}
                                </p>
                              ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Hôte à désigner</p>
                              )}
                              {reunion.dateReunion && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {format(new Date(reunion.dateReunion), "d MMM", { locale: fr })}
                                </p>
                              )}
                              {reunion.statut === "DateConfirmee" && !isAdmin && !isReunionPassee(reunion) && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">Indiquer ma présence</p>
                              )}
                              {reunion.statut === "DateConfirmee" && !isAdmin && isReunionPassee(reunion) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Présence clôturée</p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Cliquez pour choisir</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog : Choisir un mois / Modifier réunion */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-2 border-blue-200 dark:border-blue-800">
          <DialogHeader className="rounded-t-lg -mx-0 -mt-0 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white border-b border-blue-400/30">
            <DialogTitle className="text-base">
              {selectedReunion
                ? `Réunion ${moisOptions.find((m) => m.value === selectedReunion.mois)?.label} ${selectedReunion.annee}`
                : `Réunion ${moisOptions.find((m) => m.value === createFormData.mois)?.label} ${createFormData.annee}`}
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-xs mt-0.5">
              {selectedReunion
                ? (isAdmin ? "Modifier la réunion (hôte, date, lieu)." : "Voir les détails, choisir la date ou vous désister comme hôte.")
                : isAdmin
                  ? "Sélectionnez le mois, l'année et l'adhérent hôte pour la réunion mensuelle."
                  : "Sélectionnez le mois et l'année pour la réunion mensuelle. Vous serez l'hôte de cette réunion."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="createAnnee" className="text-xs">Année</Label>
                <Input
                  id="createAnnee"
                  type="number"
                  min="2020"
                  max="2100"
                  value={createFormData.annee}
                  onChange={(e) => setCreateFormData({ ...createFormData, annee: parseInt(e.target.value) || new Date().getFullYear() })}
                  disabled={!!selectedReunion}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="createMois" className="text-xs">Mois</Label>
                <Select
                  value={createFormData.mois.toString()}
                  onValueChange={(v) => setCreateFormData({ ...createFormData, mois: parseInt(v) })}
                  disabled={!!selectedReunion}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {moisOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Adhérent hôte {selectedReunion ? "(modifier)" : ""}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdherentSearchOpen(true)}
                    className="flex-1 justify-start"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {selectedAdherentHote 
                      ? `${selectedAdherentHote.firstname} ${selectedAdherentHote.lastname}`
                      : "Sélectionner l'hôte"}
                  </Button>
                  {selectedAdherentHote && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedAdherentHote(null);
                        setCreateFormData({ ...createFormData, adherentHoteId: "" });
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {!isAdmin && !selectedReunion && (
              <p className="text-xs text-gray-500">
                Une fois le mois choisi, l'admin devra valider avant que vous puissiez confirmer la date.
              </p>
            )}

            {/* Bouton "Valider la réunion" pour l'admin (réunion en attente, date déjà choisie par l'hôte) */}
            {selectedReunion && isAdmin && selectedReunion.statut === "EnAttente" && (
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4 space-y-2">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {selectedReunion.dateReunion ? "Valider la réunion" : "En attente du choix de la date par l'hôte"}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {selectedReunion.dateReunion
                    ? "L'hôte a choisi la date. Vous pouvez valider la réunion."
                    : "L'hôte doit d'abord choisir la date (samedi) dans le calendrier ci-dessous."}
                </p>
                <Button
                  type="button"
                  onClick={handleValiderMois}
                  disabled={loading || !selectedReunion.dateReunion}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Valider la réunion
                </Button>
              </div>
            )}

            {/* Bouton "Se désister comme hôte" pour l'adhérent hôte (si date à 28 j ou plus, ou pas de date) */}
            {selectedReunion && !isAdmin && (() => {
              const isHote = Boolean(user?.id && selectedReunion?.AdherentHote?.userId && user.id === selectedReunion.AdherentHote.userId);
              if (!isHote) return null;
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const dans28Jours = new Date(now);
              dans28Jours.setDate(dans28Jours.getDate() + 28);
              const dateReunion = selectedReunion.dateReunion ? new Date(selectedReunion.dateReunion) : null;
              dateReunion?.setHours(0, 0, 0, 0);
              const peutDesister = !dateReunion || dateReunion.getTime() >= dans28Jours.getTime();
              return (
                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Vous êtes l&apos;hôte de cette réunion
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {peutDesister
                      ? "Vous pouvez vous désister : le mois sera à nouveau disponible pour un autre adhérent (désistement possible uniquement si la réunion a lieu dans 28 jours ou plus)."
                      : "Le désistement n'est plus possible : la réunion a lieu dans moins de 28 jours."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDesister}
                    disabled={loading || !peutDesister}
                    className="w-full sm:w-auto border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Se désister comme hôte
                  </Button>
                </div>
              );
            })()}

            {/* Sélection / modification de la date (réunion existante) */}
            {selectedReunion && (selectedReunion.statut === "MoisValide" || selectedReunion.statut === "DateConfirmee" || selectedReunion.statut === "EnAttente" || isAdmin) && (
              <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date de la réunion (samedi)</Label>
                  {(() => {
                    const isHote = Boolean(user?.id && selectedReunion?.AdherentHote?.userId && user.id === selectedReunion.AdherentHote.userId);
                    const dateLimite = new Date();
                    dateLimite.setDate(dateLimite.getDate() + 7);
                    dateLimite.setHours(0, 0, 0, 0);
                    const dateDejaFixeeDansMoinsDe7Jours = selectedReunion.dateReunion && new Date(selectedReunion.dateReunion) <= dateLimite;
                    const lectureSeuleDate = isHote && !!dateDejaFixeeDansMoinsDe7Jours;
                    const enAttenteNonAdmin = selectedReunion.statut === "EnAttente" && !isAdmin;
                    const calendrierDesactive = lectureSeuleDate || enAttenteNonAdmin;
                    return (
                      <>
                        {enAttenteNonAdmin && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded">
                            Le mois doit être validé par l&apos;admin avant de pouvoir choisir la date.
                          </p>
                        )}
                        {isHote && dateDejaFixeeDansMoinsDe7Jours && !enAttenteNonAdmin && (
                          <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded">
                            La date ne peut plus être modifiée : réunion dans moins de 7 jours. L&apos;admin peut la modifier.
                          </p>
                        )}
                        <div className="rounded-md border p-1.5">
                          <CalendarUI
                            mode="single"
                            defaultMonth={selectedReunion ? new Date(selectedReunion.annee, selectedReunion.mois - 1) : new Date(createFormData.annee, createFormData.mois - 1)}
                            selected={confirmSelectedDate}
                            onSelect={(d) => {
                              if (calendrierDesactive) return;
                              setConfirmSelectedDate(d || undefined);
                              if (d) setEditFormData((prev) => ({ ...prev, dateReunion: dateToUtcNoonIso(d) }));
                              else setEditFormData((prev) => ({ ...prev, dateReunion: "" }));
                            }}
                            locale={fr}
                            disabled={(d) => {
                              const sameMonth = d.getFullYear() === selectedReunion.annee && d.getMonth() + 1 === selectedReunion.mois;
                              const isSaturday = d.getDay() === 6;
                              const dDebut = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                              const tropProche = isHote && !isAdmin && dDebut.getTime() < dateLimite.getTime();
                              return !sameMonth || !isSaturday || tropProche || calendrierDesactive;
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">Uniquement les samedis du mois. {isHote && !isAdmin && !enAttenteNonAdmin && "En tant qu'hôte, vous ne pouvez choisir qu'une date au moins 7 jours à l'avance."}</p>
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editTypeLieu" className="text-xs">Type de lieu</Label>
                  <Select
                    value={editFormData.typeLieu}
                    onValueChange={(v) => setEditFormData({ ...editFormData, typeLieu: v as TypeLieuReunion })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Domicile">Domicile</SelectItem>
                      <SelectItem value="Restaurant">Restaurant</SelectItem>
                      <SelectItem value="Autre">Autre lieu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editFormData.typeLieu === "Restaurant" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Nom du restaurant</Label>
                    <Input
                      value={editFormData.nomRestaurant}
                      onChange={(e) => setEditFormData({ ...editFormData, nomRestaurant: e.target.value })}
                      placeholder="Nom du restaurant"
                    />
                  </div>
                )}
                {(editFormData.typeLieu === "Autre" || editFormData.typeLieu === "Restaurant") && (
                  <div className="space-y-1">
                    <Label className="text-xs">Adresse</Label>
                    <Textarea
                      value={editFormData.adresse}
                      onChange={(e) => setEditFormData({ ...editFormData, adresse: e.target.value })}
                      rows={2}
                      className="min-h-0 text-sm"
                      placeholder="Adresse du lieu"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Commentaires</Label>
                  <Textarea
                    value={editFormData.commentaires}
                    onChange={(e) => setEditFormData({ ...editFormData, commentaires: e.target.value })}
                    rows={2}
                    placeholder="Commentaires..."
                    className="min-h-0 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <Button type="button" variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setSelectedReunion(null);
              setSelectedAdherentHote(null);
            }}>
              Annuler
            </Button>
            <Button 
              onClick={selectedReunion ? async () => {
                if (!selectedReunion) return;
                const isHote = Boolean(user?.id && selectedReunion?.AdherentHote?.userId && user.id === selectedReunion.AdherentHote.userId);
                if (!isAdmin && isHote && !editFormData.dateReunion) {
                  toast.error("Veuillez sélectionner une date (samedi)");
                  return;
                }
                setLoading(true);
                try {
                  const payload: Parameters<typeof updateReunionMensuelle>[0] = {
                    id: selectedReunion.id,
                    typeLieu: editFormData.typeLieu,
                    adresse: editFormData.adresse || undefined,
                    nomRestaurant: editFormData.nomRestaurant || undefined,
                    commentaires: editFormData.commentaires || undefined,
                  };
                  if (createFormData.adherentHoteId) payload.adherentHoteId = createFormData.adherentHoteId;
                  if (editFormData.dateReunion) payload.dateReunion = editFormData.dateReunion;
                  const result = await updateReunionMensuelle(payload);
                  if (result.success) {
                    toast.success(editFormData.dateReunion ? "Réunion mise à jour (date et lieu enregistrés)." : "Réunion mise à jour.");
                    setShowCreateDialog(false);
                    setSelectedReunion(null);
                    setSelectedAdherentHote(null);
                    loadData();
                  } else {
                    toast.error(result.error || "Erreur");
                  }
                } catch (error) {
                  toast.error("Erreur lors de l'enregistrement");
                } finally {
                  setLoading(false);
                }
              } : handleCreateReunion} 
              disabled={
                loading ||
                (!!selectedReunion && selectedReunion.statut === "EnAttente" && !isAdmin) ||
                (!!selectedReunion && !isAdmin && (() => {
                  const isHote = Boolean(user?.id && selectedReunion?.AdherentHote?.userId && user.id === selectedReunion.AdherentHote.userId);
                  if (!isHote) return false;
                  if (!editFormData.dateReunion) return true;
                  const lim = new Date();
                  lim.setDate(lim.getDate() + 7);
                  lim.setHours(0, 0, 0, 0);
                  return selectedReunion.dateReunion ? new Date(selectedReunion.dateReunion) <= lim : false;
                })())
              }
            >
              {selectedReunion ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Recherche adhérent hôte (admin) */}
      {isAdmin && (
        <InlineAdherentSearchPanel
          open={adherentSearchOpen}
          onOpenChange={setAdherentSearchOpen}
          onSelect={(adherent) => {
            setSelectedAdherentHote(adherent);
            setCreateFormData({ ...createFormData, adherentHoteId: adherent.id });
            setAdherentSearchOpen(false);
          }}
          title="Sélectionner l'adhérent hôte"
          description="Choisissez l'adhérent qui sera l'hôte de cette réunion mensuelle"
        />
      )}

      {/* Dialog : Confirmer participation */}
      <Dialog open={showParticipationDialog} onOpenChange={setShowParticipationDialog}>
        <DialogContent className="p-0 gap-0 border-2 border-blue-200 dark:border-blue-800 max-w-md">
          <DialogHeader className="rounded-t-lg px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white border-b border-blue-400/30">
            <DialogTitle className="text-base">Confirmer ma présence</DialogTitle>
            <DialogDescription className="text-blue-100 text-xs mt-0.5">
              Indiquez si vous serez présent, absent ou excusé pour cette réunion.
            </DialogDescription>
          </DialogHeader>
          {selectedReunion && (
            <div className="space-y-4 p-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="font-medium">
                  {moisOptions.find((m) => m.value === selectedReunion.mois)?.label} {selectedReunion.annee}
                </p>
                {selectedReunion.dateReunion && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(selectedReunion.dateReunion), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select
                  value={participationStatut}
                  onValueChange={(v) => setParticipationStatut(v as StatutParticipationReunion)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Present">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Présent</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Absent">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>Absent</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Excuse">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span>Je m'excuse</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commentaire">Commentaire (optionnel)</Label>
                <Textarea
                  id="commentaire"
                  value={participationCommentaire}
                  onChange={(e) => setParticipationCommentaire(e.target.value)}
                  rows={3}
                  placeholder="Message d'excuse ou commentaire..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <Button type="button" variant="outline" onClick={() => setShowParticipationDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmParticipation} disabled={loading}>
              {getParticipationSubmitLabel(participationStatut)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Confirmer la date (pour l'hôte) */}
      {selectedReunion && selectedReunion.statut === "MoisValide" && (
        <Dialog open={!!selectedReunion && selectedReunion.statut === "MoisValide"} onOpenChange={(open) => !open && setSelectedReunion(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirmer la date de la réunion</DialogTitle>
              <DialogDescription>
                Le mois a été validé. Vous pouvez maintenant confirmer la date et le lieu de la réunion. La date ne peut être modifiée que si la réunion a lieu dans plus de 7 jours.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Date (samedi) *</Label>
                {(() => {
                  const isHote = Boolean(user?.id && selectedReunion?.AdherentHote?.userId && user.id === selectedReunion.AdherentHote.userId);
                  const dateLimite = new Date();
                  dateLimite.setDate(dateLimite.getDate() + 7);
                  dateLimite.setHours(0, 0, 0, 0);
                  const dateDejaFixeeDansMoinsDe7Jours = selectedReunion.dateReunion && new Date(selectedReunion.dateReunion) <= dateLimite;
                  return (
                    <>
                      {isHote && dateDejaFixeeDansMoinsDe7Jours && (
                        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded">
                          La date ne peut plus être modifiée : la réunion a lieu dans moins de 7 jours. Un administrateur peut toutefois la modifier.
                        </p>
                      )}
                      <div className="rounded-md border p-2">
                        <CalendarUI
                          mode="single"
                          defaultMonth={new Date(selectedReunion.annee, selectedReunion.mois - 1)}
                          selected={confirmSelectedDate}
                          onSelect={(d) => {
                            setConfirmSelectedDate(d || undefined);
                            if (d) setEditFormData((prev) => ({ ...prev, dateReunion: dateToUtcNoonIso(d) }));
                            else setEditFormData((prev) => ({ ...prev, dateReunion: "" }));
                          }}
                          locale={fr}
                          disabled={(d) => {
                            const sameMonth = d.getFullYear() === selectedReunion.annee && d.getMonth() + 1 === selectedReunion.mois;
                            const isSaturday = d.getDay() === 6;
                            const dDebut = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                            const tropProche = isHote && (dDebut.getTime() < dateLimite.getTime());
                            return !sameMonth || !isSaturday || tropProche || (isHote && !!dateDejaFixeeDansMoinsDe7Jours);
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">Uniquement les samedis du mois. En tant qu&apos;hôte, vous ne pouvez choisir qu&apos;une date au moins 7 jours à l&apos;avance.</p>
                    </>
                  );
                })()}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editTypeLieu">Type de lieu</Label>
                <Select
                  value={editFormData.typeLieu}
                  onValueChange={(v) => setEditFormData({ ...editFormData, typeLieu: v as TypeLieuReunion })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Domicile">Domicile (par défaut)</SelectItem>
                    <SelectItem value="Restaurant">Restaurant</SelectItem>
                    <SelectItem value="Autre">Autre lieu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editFormData.typeLieu === "Restaurant" && (
                <div className="space-y-1.5">
                  <Label htmlFor="editNomRestaurant">Nom du restaurant</Label>
                  <Input
                    id="editNomRestaurant"
                    value={editFormData.nomRestaurant}
                    onChange={(e) => setEditFormData({ ...editFormData, nomRestaurant: e.target.value })}
                  />
                </div>
              )}
              {(editFormData.typeLieu === "Autre" || editFormData.typeLieu === "Restaurant") && (
                <div className="space-y-1.5">
                  <Label htmlFor="editAdresse">Adresse complète</Label>
                  <Textarea
                    id="editAdresse"
                    value={editFormData.adresse}
                    onChange={(e) => setEditFormData({ ...editFormData, adresse: e.target.value })}
                    rows={3}
                    placeholder="Adresse complète du lieu de réunion"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="editCommentaires">Commentaires</Label>
                <Textarea
                  id="editCommentaires"
                  value={editFormData.commentaires}
                  onChange={(e) => setEditFormData({ ...editFormData, commentaires: e.target.value })}
                  rows={3}
                  placeholder="Informations complémentaires..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedReunion(null)}>
                Annuler
              </Button>
              <Button
                onClick={handleConfirmDate}
                disabled={
                  loading ||
                  !editFormData.dateReunion ||
                  (() => {
                    if (!user?.id || !selectedReunion?.AdherentHote?.userId || user.id !== selectedReunion.AdherentHote.userId || !selectedReunion.dateReunion) return false;
                    const lim = new Date();
                    lim.setDate(lim.getDate() + 7);
                    lim.setHours(0, 0, 0, 0);
                    return new Date(selectedReunion.dateReunion) <= lim;
                  })()
                }
              >
                Confirmer la date
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
