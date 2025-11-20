"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

interface Reservation {
  id: string;
  dateDebut: Date;
  dateFin: Date;
  statut: string;
  Ressource: {
    id: string;
    nom: string;
    type: string;
  };
  Adherent?: {
    firstname: string;
    lastname: string;
    User?: {
      name: string;
      email: string;
    };
  };
  visiteurNom?: string;
  visiteurEmail?: string;
  nombrePersonnes?: number;
  motif?: string;
}

interface CalendrierReservationsProps {
  reservations: Reservation[];
  ressourceId?: string;
  onDateClick?: (date: Date) => void;
  onReservationClick?: (reservation: Reservation) => void;
  className?: string;
}

export function CalendrierReservations({
  reservations,
  ressourceId,
  onDateClick,
  onReservationClick,
  className,
}: CalendrierReservationsProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRessource, setSelectedRessource] = useState<string>(ressourceId || "all");

  // Filtrer les réservations par ressource si sélectionnée
  const filteredReservations = useMemo(() => {
    if (selectedRessource === "all") {
      return reservations;
    }
    return reservations.filter((r) => r.Ressource.id === selectedRessource);
  }, [reservations, selectedRessource]);

  // Grouper les réservations par date
  const reservationsByDate = useMemo(() => {
    const grouped: Record<string, Reservation[]> = {};
    filteredReservations.forEach((reservation) => {
      const dateKey = format(new Date(reservation.dateDebut), "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(reservation);
    });
    return grouped;
  }, [filteredReservations]);

  // Obtenir les ressources uniques
  const ressources = useMemo(() => {
    const unique = new Map<string, { id: string; nom: string; type: string }>();
    reservations.forEach((r) => {
      if (!unique.has(r.Ressource.id)) {
        unique.set(r.Ressource.id, r.Ressource);
      }
    });
    return Array.from(unique.values());
  }, [reservations]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Ajouter les jours du début du mois pour compléter la première semaine
  const firstDayOfWeek = monthStart.getDay();
  const daysBeforeMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const previousMonthDays = Array.from({ length: daysBeforeMonth }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - daysBeforeMonth + i);
    return date;
  });

  // Ajouter les jours de la fin du mois pour compléter la dernière semaine
  const lastDayOfWeek = monthEnd.getDay();
  const daysAfterMonth = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const nextMonthDays = Array.from({ length: daysAfterMonth }, (_, i) => {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + i + 1);
    return date;
  });

  const allDays = [...previousMonthDays, ...daysInMonth, ...nextMonthDays];

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case "Confirmee":
        return "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300";
      case "EnAttente":
        return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300";
      case "Annulee":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300";
      case "Terminee":
        return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300";
      default:
        return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case "Confirmee":
        return "Confirmée";
      case "EnAttente":
        return "En attente";
      case "Annulee":
        return "Annulée";
      case "Terminee":
        return "Terminée";
      default:
        return statut;
    }
  };

  return (
    <Card className={`!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 ${className || ""}`}>
      <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" />
            <span>Calendrier des Réservations</span>
          </CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={selectedRessource} onValueChange={setSelectedRessource}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Toutes les ressources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les ressources</SelectItem>
                {ressources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Navigation du mois */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendrier */}
        <div className="space-y-2">
          {/* En-têtes des jours */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Jours du calendrier */}
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((day, index) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayReservations = reservationsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`
                    min-h-[80px] sm:min-h-[100px] p-1 border rounded-lg
                    ${isCurrentMonth ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900/50"}
                    ${isToday ? "ring-2 ring-blue-500" : ""}
                    ${onDateClick ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" : ""}
                    transition-colors
                  `}
                  onClick={() => onDateClick?.(day)}
                >
                  <div
                    className={`
                      text-xs font-medium mb-1
                      ${isCurrentMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-600"}
                      ${isToday ? "text-blue-600 dark:text-blue-400 font-bold" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayReservations.slice(0, 2).map((reservation) => (
                      <div
                        key={reservation.id}
                        className={`
                          text-[10px] px-1 py-0.5 rounded border truncate
                          ${getStatutColor(reservation.statut)}
                          ${onReservationClick ? "cursor-pointer hover:opacity-80" : ""}
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReservationClick?.(reservation);
                        }}
                        title={`${reservation.Ressource.nom} - ${getStatutLabel(reservation.statut)}`}
                      >
                        <div className="truncate">{reservation.Ressource.nom}</div>
                      </div>
                    ))}
                    {dayReservations.length > 2 && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
                        +{dayReservations.length - 2} autre(s)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Légende */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border bg-green-100 border-green-300"></div>
              <span className="text-gray-600 dark:text-gray-400">Confirmée</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border bg-amber-100 border-amber-300"></div>
              <span className="text-gray-600 dark:text-gray-400">En attente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border bg-red-100 border-red-300"></div>
              <span className="text-gray-600 dark:text-gray-400">Annulée</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border bg-gray-100 border-gray-300"></div>
              <span className="text-gray-600 dark:text-gray-400">Terminée</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

