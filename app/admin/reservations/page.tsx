"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendrierReservations } from "@/components/admin/CalendrierReservations";
import { MetricCard } from "@/components/admin/MetricCard";
import {
  Calendar,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Users,
  RefreshCw,
  Building2,
  AlertCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllRessources,
  getAllReservations,
  createRessource,
  createReservation,
  confirmerReservation,
  annulerReservation,
  getReservationsStats,
} from "@/actions/reservations";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TypeRessource, StatutReservation } from "@prisma/client";

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true);
  const [ressources, setRessources] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [showCreateRessource, setShowCreateRessource] = useState(false);
  const [showCreateReservation, setShowCreateReservation] = useState(false);
  const [filterStatut, setFilterStatut] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ressourcesResult, reservationsResult, statsResult] = await Promise.all([
        getAllRessources(),
        getAllReservations(),
        getReservationsStats(),
      ]);

      if (ressourcesResult.success && ressourcesResult.data) {
        setRessources(ressourcesResult.data);
      }

      if (reservationsResult.success && reservationsResult.data) {
        setReservations(reservationsResult.data);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRessource = async (formData: FormData) => {
    try {
      const result = await createRessource(formData);
      if (result.success) {
        toast.success(result.message);
        setShowCreateRessource(false);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création de la ressource");
    }
  };

  const handleCreateReservation = async (formData: FormData) => {
    try {
      const result = await createReservation(formData);
      if (result.success) {
        toast.success(result.message);
        setShowCreateReservation(false);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création de la réservation");
    }
  };

  const handleConfirmer = async (reservationId: string) => {
    try {
      const result = await confirmerReservation(reservationId);
      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la confirmation");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la confirmation");
    }
  };

  const handleAnnuler = async (reservationId: string) => {
    try {
      const result = await annulerReservation(reservationId);
      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de l'annulation");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'annulation");
    }
  };

  const filteredReservations = filterStatut === "all"
    ? reservations
    : reservations.filter((r) => r.statut === filterStatut);

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case "Confirmee":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Confirmée</Badge>;
      case "EnAttente":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">En attente</Badge>;
      case "Annulee":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Annulée</Badge>;
      case "Terminee":
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300">Terminée</Badge>;
      default:
        return <Badge>{statut}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Building2 className="h-8 w-8 text-blue-600" />
                Gestion des Réservations
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
                Gérez les réservations de salles, matériel et autres ressources
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={showCreateRessource} onOpenChange={setShowCreateRessource}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle Ressource
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer une Ressource</DialogTitle>
                    <DialogDescription>
                      Ajoutez une nouvelle ressource (salle, matériel, etc.)
                    </DialogDescription>
                  </DialogHeader>
                  <form action={handleCreateRessource} className="space-y-4">
                    <div>
                      <Label htmlFor="nom">Nom *</Label>
                      <Input id="nom" name="nom" required />
                    </div>
                    <div>
                      <Label htmlFor="type">Type *</Label>
                      <select
                        id="type"
                        name="type"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Sélectionner un type</option>
                        {Object.values(TypeRessource).map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" name="description" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="capacite">Capacité</Label>
                        <Input id="capacite" name="capacite" type="number" />
                      </div>
                      <div>
                        <Label htmlFor="localisation">Localisation</Label>
                        <Input id="localisation" name="localisation" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit">Créer</Button>
                      <Button type="button" variant="outline" onClick={() => setShowCreateRessource(false)}>
                        Annuler
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={showCreateReservation} onOpenChange={setShowCreateReservation}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle Réservation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer une Réservation</DialogTitle>
                    <DialogDescription>
                      Réservez une ressource pour une date et une heure spécifiques
                    </DialogDescription>
                  </DialogHeader>
                  <form action={handleCreateReservation} className="space-y-4">
                    <div>
                      <Label htmlFor="ressourceId">Ressource *</Label>
                      <select
                        id="ressourceId"
                        name="ressourceId"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Sélectionner une ressource</option>
                        {ressources.filter((r) => r.actif && r.reservable).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nom} ({r.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dateDebut">Date et heure de début *</Label>
                        <Input id="dateDebut" name="dateDebut" type="datetime-local" required />
                      </div>
                      <div>
                        <Label htmlFor="dateFin">Date et heure de fin *</Label>
                        <Input id="dateFin" name="dateFin" type="datetime-local" required />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="motif">Motif</Label>
                      <Textarea id="motif" name="motif" />
                    </div>
                    <div>
                      <Label htmlFor="nombrePersonnes">Nombre de personnes</Label>
                      <Input id="nombrePersonnes" name="nombrePersonnes" type="number" />
                    </div>
                    <div>
                      <Label htmlFor="commentaires">Commentaires</Label>
                      <Textarea id="commentaires" name="commentaires" />
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit">Créer</Button>
                      <Button type="button" variant="outline" onClick={() => setShowCreateReservation(false)}>
                        Annuler
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Métriques */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
            <MetricCard
              title="Total Réservations"
              value={stats.totalReservations}
              icon={Calendar}
              color="blue"
            />
            <MetricCard
              title="En Attente"
              value={stats.reservationsEnAttente}
              icon={Clock}
              color="amber"
            />
            <MetricCard
              title="Confirmées"
              value={stats.reservationsConfirmees}
              icon={CheckCircle}
              color="green"
            />
            <MetricCard
              title="Aujourd'hui"
              value={stats.reservationsAujourdhui}
              icon={Calendar}
              color="purple"
            />
            <MetricCard
              title="Ressources Actives"
              value={stats.ressourcesActives}
              icon={Building2}
              color="indigo"
            />
          </div>
        )}

        {/* Calendrier */}
        <div className="mb-8">
          <CalendrierReservations
            reservations={reservations.map((r) => ({
              ...r,
              dateDebut: new Date(r.dateDebut),
              dateFin: new Date(r.dateFin),
            }))}
            onReservationClick={(reservation) => setSelectedReservation(reservation)}
          />
        </div>

        {/* Liste des réservations */}
        <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-base sm:text-lg text-gray-700 dark:text-gray-200">
                Liste des Réservations
              </CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={filterStatut} onValueChange={setFilterStatut}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="EnAttente">En attente</SelectItem>
                    <SelectItem value="Confirmee">Confirmées</SelectItem>
                    <SelectItem value="Annulee">Annulées</SelectItem>
                    <SelectItem value="Terminee">Terminées</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            {filteredReservations.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Aucune réservation trouvée</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {reservation.Ressource.nom}
                          </h3>
                          {getStatutBadge(reservation.statut)}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {format(new Date(reservation.dateDebut), "dd MMMM yyyy à HH:mm", { locale: fr })} -{" "}
                              {format(new Date(reservation.dateFin), "HH:mm", { locale: fr })}
                            </span>
                          </div>
                          {reservation.Ressource.localisation && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{reservation.Ressource.localisation}</span>
                            </div>
                          )}
                          {reservation.Adherent ? (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>
                                {reservation.Adherent.firstname} {reservation.Adherent.lastname}
                              </span>
                            </div>
                          ) : (
                            reservation.visiteurNom && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>{reservation.visiteurNom}</span>
                              </div>
                            )
                          )}
                          {reservation.motif && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                              <strong>Motif :</strong> {reservation.motif}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {reservation.statut === "EnAttente" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConfirmer(reservation.id)}
                            className="border-green-300 text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Confirmer
                          </Button>
                        )}
                        {reservation.statut !== "Annulee" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAnnuler(reservation.id)}
                            className="border-red-300 text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

