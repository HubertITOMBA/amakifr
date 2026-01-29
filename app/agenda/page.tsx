"use client";

import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Bell, 
  ChevronRight,
  Plus,
  Filter,
  Search,
  Download,
  Share2,
  Star,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { getAdherentEvenements } from "@/actions/evenements";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Données d'exemple pour l'agenda (fallback)
const agendaDataFallback = {
  "Ce Mois": [
    {
      id: 1,
      title: "Préparation de l'élection",
      date: "23 octobre 2025",
      time: "14:00",
      location: "Whatsapp Amaki France NewLock",
      type: "officiel",
      status: "confirmed",
      attendees: 45,
      description: "Prépartion des élections. Dépôt des candidatures jusqu'au 15 novembre 2025. Analyse de profils de candidats.",
      priority: "high"
    },
    {
      id: 2,
      title: "Préparation anniversaire",
      date: "23 octobre 2025",
      time: "09:00",
      location: "Centre de Formation - Paris",
      type: "formation",
      status: "confirmed",
      attendees: 20,
      description: "Attente de cadeaux",
      priority: "medium"
    },
    {
      id: 3,
      title: "Réunion commité directeur",
      date: "2024-01-28",
      time: "19:00",
      location: "Whatsapp Amaki France NewLock",
      type: "social",
      status: "pending",
      attendees: 30,
      description: "Rencontre en ligne de membres du comité directeur pour échanger les prochaines élections.",
      priority: "low"
    }
  ],
  "Prochain Mois": [
    {
      id: 4,
      title: "Mission Humanitaire",
      date: "2024-02-05",
      time: "08:00",
      location: "Kipaku, Congo",
      type: "humanitaire",
      status: "confirmed",
      attendees: 15,
      description: "Retour au pays pour des actions de solidarité et de développement communautaire.",
      priority: "high"
    },
    {
      id: 5,
      title: "Conférence Entrepreneuriat",
      date: "2024-02-12",
      time: "10:00",
      location: "Auditorium - Marseille",
      type: "formation",
      status: "confirmed",
      attendees: 100,
      description: "Conférence sur l'entrepreneuriat et la création d'entreprise en France.",
      priority: "medium"
    },
    {
      id: 6,
      title: "Collecte de Vêtements",
      date: "2024-02-18",
      time: "10:00",
      location: "Place du Marché - Strasbourg",
      type: "caritatif",
      status: "confirmed",
      attendees: 25,
      description: "Organisation d'une collecte de vêtements pour les familles dans le besoin.",
      priority: "medium"
    },
    {
      id: 9,
      title: "Réunion Mensuelle",
      date: "29 novembre 2025",
      time: "14:00",
      location: "Villenoy 77124",
      type: "officiel",
      status: "confirmed",
      attendees: 35,
      description: "Réunion mensuelle de l'association pour discuter des projets en cours et des nouvelles initiatives.",
      priority: "high"
    },
    {
      id: 10,
      title: "Anniversaire de Thété",
      date: "2025-11-21",
      time: "18:00",
      location: "Villiers-Le-Bel",
      type: "social",
      status: "confirmed",
      attendees: 25,
      description: "Célébration de l'anniversaire de notre membre Thété. Moment convivial de partage et de festivité.",
      priority: "medium"
    }
  ],
  "Événements Spéciaux": [
    {
      id: 7,
      title: "Élection du Nouveau Président",
      date: "2025-11-29",
      time: "14:00",
      location: "Salle des Fêtes - Lieusaint",
      type: "officiel",
      status: "confirmed",
      attendees: 80,
      description: "Élection du nouveau président et des membres du comité directeur.",
      priority: "high"
    },
    {
      id: 8,
      title: "Anniversaire d'un Membre",
      date: "2025-11-21",
      time: "18:00",
      location: "Restaurant - Paris",
      type: "social",
      status: "confirmed",
      attendees: 20,
      description: "Célébration de l'anniversaire d'un membre de l'association.",
      priority: "low"
    }
  ]
};

const typeColors = {
  officiel: {
    bg: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-800 dark:text-blue-200",
    badge: "bg-blue-500"
  },
  formation: {
    bg: "bg-green-100 dark:bg-green-900",
    text: "text-green-800 dark:text-green-200",
    badge: "bg-green-500"
  },
  social: {
    bg: "bg-purple-100 dark:bg-purple-900",
    text: "text-purple-800 dark:text-purple-200",
    badge: "bg-purple-500"
  },
  humanitaire: {
    bg: "bg-orange-100 dark:bg-orange-900",
    text: "text-orange-800 dark:text-orange-200",
    badge: "bg-orange-500"
  },
  caritatif: {
    bg: "bg-pink-100 dark:bg-pink-900",
    text: "text-pink-800 dark:text-pink-200",
    badge: "bg-pink-500"
  }
};

const statusColors = {
  confirmed: {
    bg: "bg-green-100 dark:bg-green-900",
    text: "text-green-800 dark:text-green-200",
    icon: CheckCircle
  },
  pending: {
    bg: "bg-yellow-100 dark:bg-yellow-900",
    text: "text-yellow-800 dark:text-yellow-200",
    icon: AlertCircle
  },
  cancelled: {
    bg: "bg-red-100 dark:bg-red-900",
    text: "text-red-800 dark:text-red-200",
    icon: Info
  }
};

export default function AgendaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [agendaData, setAgendaData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // Vérifier l'authentification et le statut d'adhérent
  useEffect(() => {
    if (status === "loading") return; // Attendre le chargement de la session
    
    if (status === "unauthenticated") {
      // Rediriger silencieusement vers la page publique des événements
      // Ne pas afficher de toast car cela peut être dû à une déconnexion
      router.push("/evenements");
      return;
    }

    if (status === "authenticated") {
      loadAgendaData();
    }
  }, [status, router]);

  const loadAgendaData = async () => {
    try {
      setLoading(true);
      const result = await getAdherentEvenements();
        
      if (result.success && result.data) {
        const evenements = result.data;
        
        // Si erreur d'autorisation, rediriger vers la page publique des événements
        if (result.error && (result.error.includes("connecté") || result.error.includes("adhérent"))) {
          // Ne pas afficher de toast car cela peut être dû à une déconnexion
          // Rediriger silencieusement vers la page publique
          router.push("/evenements");
          return;
        }
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const nextMonth = new Date(currentYear, currentMonth + 1, 1);
        
        // Organiser les événements par catégories temporelles
        const organized: Record<string, any[]> = {
          "Ce Mois": [],
          "Prochain Mois": [],
          "Événements Spéciaux": []
        };

        evenements.forEach((event: any) => {
          const eventDate = new Date(event.dateDebut);
          const eventMonth = eventDate.getMonth();
          const eventYear = eventDate.getFullYear();
          
          // Extraire l'heure de la date
          const time = format(eventDate, "HH:mm", { locale: fr });
          
          // Mapper les catégories aux types de couleur
          const categoryToTypeMap: Record<string, string> = {
            "general": "officiel",
            "formation": "formation",
            "social": "social",
            "sportif": "social", // Les événements sportifs sont traités comme sociaux
            "culturel": "social", // Les événements culturels sont traités comme sociaux
          };
          
          const category = event.categorie?.toLowerCase() || "general";
          const eventType = categoryToTypeMap[category] || "officiel";
          
          const eventData = {
            id: event.id,
            title: event.titre,
            date: event.dateDebut,
            time: time,
            location: event.lieu || event.adresse || "",
            type: eventType,
            status: "confirmed" as const,
            attendees: event._count?.Inscriptions || 0,
            description: event.description || "",
            priority: event.tags?.includes("important") ? "high" as const : "medium" as const,
          };

          // Catégoriser par période
          if (eventYear === currentYear && eventMonth === currentMonth) {
            organized["Ce Mois"].push(eventData);
          } else if (eventYear === nextMonth.getFullYear() && eventMonth === nextMonth.getMonth()) {
            organized["Prochain Mois"].push(eventData);
          } else {
            // Événements spéciaux (futurs ou passés importants)
            if (eventDate >= now || event.tags?.includes("important")) {
              organized["Événements Spéciaux"].push(eventData);
            }
          }
        });

        // Trier chaque catégorie par date
        Object.keys(organized).forEach((key) => {
          organized[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });

        setAgendaData(organized);
      } else {
        // Utiliser les données de fallback si erreur
        setAgendaData(agendaDataFallback);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'agenda:", error);
      setAgendaData(agendaDataFallback);
    } finally {
      setLoading(false);
    }
  };

  const categories = Object.keys(agendaData);
  const allEvents = Object.values(agendaData).flat();

  const filteredEvents = allEvents.filter(event =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return format(date, "EEEE d MMMM yyyy", { locale: fr });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      {/* Hero Section */}
      <section className="relative py-8 sm:py-12 md:py-16 lg:py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-4 sm:mb-6 md:mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 sm:p-5 md:p-6 shadow-2xl">
              <Calendar className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 sm:mb-4 md:mb-6 text-white drop-shadow-lg">
            Agenda AMAKI
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl mb-4 sm:mb-6 md:mb-8 text-purple-100 px-4">
            Découvrez tous nos événements et activités à venir
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center px-4">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs sm:text-sm md:text-base lg:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2" />
              Événements
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs sm:text-sm md:text-base lg:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2" />
              Communauté
            </Badge>
          </div>
        </div>
      </section>

      {/* Barre de recherche et filtres */}
      <section className="py-4 sm:py-6 md:py-8 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch lg:items-center justify-between">
            {/* Barre de recherche */}
            <div className="relative flex-1 w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un événement..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-28 pr-4"
              />
            </div>

            {/* Filtres par catégorie */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Tous les événements</span>
                <span className="sm:hidden">Tous</span>
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm"
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Exporter</span>
              </Button>
              <Button variant="outline" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Partager</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu de l'agenda */}
      <section className="py-8 sm:py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-600" />
                <p className="text-gray-600 dark:text-gray-400">Chargement de l'agenda...</p>
              </div>
            </div>
          ) : selectedCategory ? (
            // Affichage d'une catégorie spécifique
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              <div className="text-center mb-6 sm:mb-8 md:mb-12">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
                  {selectedCategory}
                </h2>
                <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
                  {selectedCategory === "Ce Mois" && "Événements prévus pour le mois en cours"}
                  {selectedCategory === "Prochain Mois" && "Événements prévus pour le mois prochain"}
                  {selectedCategory === "Événements Spéciaux" && "Événements exceptionnels et importants"}
                </p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                {agendaData[selectedCategory as keyof typeof agendaData].map((event) => {
                  const typeColor = typeColors[event.type as keyof typeof typeColors] || typeColors.officiel;
                  const statusColor = statusColors[event.status as keyof typeof statusColors] || statusColors.confirmed;
                  const StatusIcon = statusColor.icon;

                  return (
                    <Card 
                      key={event.id} 
                      className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <CardContent className="p-4 sm:p-5 md:p-6">
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge className={`${typeColor.badge} text-white text-xs`}>
                                {event.type}
                              </Badge>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColor.bg} ${statusColor.text}`}>
                                <StatusIcon className="h-3 w-3" />
                                <span className="hidden sm:inline">{event.status}</span>
                              </div>
                            </div>
                            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {event.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
                              {event.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            {event.priority === "high" && <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />}
                          </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="font-medium truncate">{formatDate(event.date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span>{event.time}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span>{event.attendees} participants</span>
                          </div>
                        </div>

                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <Button variant="outline" size="sm" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              Rappel
                            </Button>
                            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            // Affichage de toutes les catégories
            <div className="space-y-8 sm:space-y-12 md:space-y-16">
              {categories.map((category) => {
                const categoryEvents = agendaData[category as keyof typeof agendaData];
                
                return (
                  <div key={category} className="space-y-4 sm:space-y-6 md:space-y-8">
                    <div className="text-center">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
                        {category}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
                        {category === "Ce Mois" && "Événements prévus pour le mois en cours"}
                        {category === "Prochain Mois" && "Événements prévus pour le mois prochain"}
                        {category === "Événements Spéciaux" && "Événements exceptionnels et importants"}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                      {categoryEvents.slice(0, 3).map((event) => {
                        const typeColor = typeColors[event.type as keyof typeof typeColors] || typeColors.officiel;
                        const statusColor = statusColors[event.status as keyof typeof statusColors] || statusColors.confirmed;
                        const StatusIcon = statusColor.icon;

                        return (
                          <Card 
                            key={event.id} 
                            className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <CardContent className="p-3 sm:p-4">
                              <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                                <Badge className={`${typeColor.badge} text-white text-xs`}>
                                  {event.type}
                                </Badge>
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColor.bg} ${statusColor.text}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  <span className="hidden sm:inline">{event.status}</span>
                                </div>
                              </div>
                              
                              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {event.title}
                              </h3>
                              
                              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                  <span className="truncate">{formatDate(event.date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                  <span>{event.time}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    <div className="text-center">
                      <Button 
                        variant="outline"
                        onClick={() => setSelectedCategory(category)}
                        className="px-4 sm:px-6 md:px-8 py-2 text-xs sm:text-sm"
                      >
                        <span className="hidden sm:inline">Voir tous les événements {category.toLowerCase()}</span>
                        <span className="sm:hidden">Voir tout</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Modal pour afficher les détails */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-y-auto">
              <div className="flex items-start justify-between mb-4 sm:mb-5 md:mb-6 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4 flex-wrap">
                    <Badge className={`${(typeColors[selectedEvent.type as keyof typeof typeColors] || typeColors.officiel).badge} text-white text-xs sm:text-sm`}>
                      {selectedEvent.type}
                    </Badge>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${(statusColors[selectedEvent.status as keyof typeof statusColors] || statusColors.confirmed).bg} ${(statusColors[selectedEvent.status as keyof typeof statusColors] || statusColors.confirmed).text}`}>
                      {(() => {
                        const StatusIconForModal = statusColors[selectedEvent.status as keyof typeof statusColors]?.icon;
                        const IconComponent = StatusIconForModal;
                        return IconComponent ? <IconComponent className="h-3 w-3" /> : null;
                      })()}
                      {selectedEvent.status}
                    </div>
                    {selectedEvent.priority === "high" && <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />}
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                    {selectedEvent.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-5 md:mb-6">
                    {selectedEvent.description}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-2 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-5 md:mb-6">
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <span className="font-medium truncate">{formatDate(selectedEvent.date)}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <span>{selectedEvent.time}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <span className="truncate">{selectedEvent.location}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <span>{selectedEvent.attendees} participants</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
                <Button className="flex items-center justify-center gap-2 w-full sm:w-auto text-xs sm:text-sm">
                  <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Ajouter un rappel
                </Button>
                <Button variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto text-xs sm:text-sm">
                  <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Partager
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
