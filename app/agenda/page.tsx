"use client";

import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Info
} from "lucide-react";
import { useState } from "react";

// Données d'exemple pour l'agenda
const agendaData = {
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
      location: "Kipako, Congo",
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const categories = Object.keys(agendaData);
  const allEvents = Object.values(agendaData).flat();

  const filteredEvents = allEvents.filter(event =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <Calendar className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Agenda AMAKI
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-purple-100">
            Découvrez tous nos événements et activités à venir
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Calendar className="h-5 w-5 mr-2" />
              Événements
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Users className="h-5 w-5 mr-2" />
              Communauté
            </Badge>
          </div>
        </div>
      </section>

      {/* Barre de recherche et filtres */}
      <section className="py-8 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Barre de recherche */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un événement..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filtres par catégorie */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                className="px-4 py-2"
              >
                Tous les événements
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className="px-4 py-2"
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exporter
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Partager
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu de l'agenda */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {selectedCategory ? (
            // Affichage d'une catégorie spécifique
            <div className="space-y-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedCategory}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                  {selectedCategory === "Ce Mois" && "Événements prévus pour le mois en cours"}
                  {selectedCategory === "Prochain Mois" && "Événements prévus pour le mois prochain"}
                  {selectedCategory === "Événements Spéciaux" && "Événements exceptionnels et importants"}
                </p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {agendaData[selectedCategory as keyof typeof agendaData].map((event) => {
                  const typeColor = typeColors[event.type as keyof typeof typeColors];
                  const statusColor = statusColors[event.status as keyof typeof statusColors];
                  const StatusIcon = statusColor.icon;

                  return (
                    <Card 
                      key={event.id} 
                      className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`${typeColor.badge} text-white`}>
                                {event.type}
                              </Badge>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColor.bg} ${statusColor.text}`}>
                                <StatusIcon className="h-3 w-3" />
                                {event.status}
                              </div>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {event.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                              {event.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {event.priority === "high" && <Star className="h-5 w-5 text-yellow-500" />}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">{formatDate(event.date)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="h-4 w-4" />
                            <span>{event.time}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <Users className="h-4 w-4" />
                            <span>{event.attendees} participants</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                              <Bell className="h-4 w-4" />
                              Rappel
                            </Button>
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
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
            <div className="space-y-16">
              {categories.map((category) => {
                const categoryEvents = agendaData[category as keyof typeof agendaData];
                
                return (
                  <div key={category} className="space-y-8">
                    <div className="text-center">
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                        {category}
                      </h2>
                      <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                        {category === "Ce Mois" && "Événements prévus pour le mois en cours"}
                        {category === "Prochain Mois" && "Événements prévus pour le mois prochain"}
                        {category === "Événements Spéciaux" && "Événements exceptionnels et importants"}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryEvents.slice(0, 3).map((event) => {
                        const typeColor = typeColors[event.type as keyof typeof typeColors];
                        const statusColor = statusColors[event.status as keyof typeof statusColors];
                        const StatusIcon = statusColor.icon;

                        return (
                          <Card 
                            key={event.id} 
                            className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge className={`${typeColor.badge} text-white text-xs`}>
                                  {event.type}
                                </Badge>
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColor.bg} ${statusColor.text}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {event.status}
                                </div>
                              </div>
                              
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {event.title}
                              </h3>
                              
                              <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDate(event.date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span>{event.time}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
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
                        className="px-8 py-3"
                      >
                        Voir tous les événements {category.toLowerCase()}
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className={`${typeColors[selectedEvent.type as keyof typeof typeColors].badge} text-white`}>
                      {selectedEvent.type}
                    </Badge>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColors[selectedEvent.status as keyof typeof statusColors].bg} ${statusColors[selectedEvent.status as keyof typeof statusColors].text}`}>
                      <StatusIcon className="h-3 w-3" />
                      {selectedEvent.status}
                    </div>
                    {selectedEvent.priority === "high" && <Star className="h-5 w-5 text-yellow-500" />}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {selectedEvent.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {selectedEvent.description}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                >
                  <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium">{formatDate(selectedEvent.date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>{selectedEvent.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>{selectedEvent.location}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>{selectedEvent.attendees} participants</span>
                </div>
              </div>

              <div className="flex gap-4">
                <Button className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Ajouter un rappel
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
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
