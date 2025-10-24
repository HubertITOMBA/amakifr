import { Calendar, MapPin, Users, Clock, ArrowRight } from "lucide-react";
import Image from "next/image";

export function EventsSection() {
  const events = [
    {
      id: 1,
      title: "Conférence sur l'Entrepreneuriat",
      date: "15 Mars 2024",
      time: "14h00 - 17h00",
      location: "Salle de conférence AMAKI",
      attendees: 120,
      image: "/images/event1.jpg",
      description: "Une conférence inspirante sur l'entrepreneuriat avec des anciens élèves qui ont réussi dans leurs domaines respectifs.",
      status: "À venir"
    },
    {
      id: 2,
      title: "Soirée Réseautage",
      date: "22 Mars 2024",
      time: "18h00 - 22h00",
      location: "Hôtel des Gouverneurs",
      attendees: 80,
      image: "/images/event2.jpg",
      description: "Une soirée de networking pour renforcer les liens entre les membres et créer de nouvelles opportunités.",
      status: "À venir"
    },
    {
      id: 3,
      title: "Atelier de Développement Personnel",
      date: "5 Avril 2024",
      time: "09h00 - 12h00",
      location: "Centre de Formation AMAKI",
      attendees: 50,
      image: "/images/event3.jpg",
      description: "Un atelier pratique pour développer vos compétences en leadership et communication.",
      status: "Inscription ouverte"
    }
  ];

  return (
    <section className="py-20 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Nos Prochains Événements
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Découvrez notre calendrier d'événements et participez aux activités 
            qui renforcent notre communauté et développent nos compétences.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden group"
            >
              {/* Image de l'événement */}
              <div className="relative h-48 bg-gradient-to-br from-blue-500 to-purple-600">
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    event.status === "À venir" 
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  }`}>
                    {event.status}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-xl font-bold">{event.title}</h3>
                </div>
              </div>
              
              {/* Contenu de la carte */}
              <div className="p-6">
                <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                  {event.description}
                </p>
                
                {/* Détails de l'événement */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-2" />
                    {event.date}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4 mr-2" />
                    {event.time}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4 mr-2" />
                    {event.location}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4 mr-2" />
                    {event.attendees} participants
                  </div>
                </div>
                
                {/* Bouton d'action */}
                <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-300 flex items-center justify-center group">
                  S'inscrire
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Bouton pour voir tous les événements */}
        <div className="text-center mt-12">
          <button className="px-8 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-300">
            Voir Tous les Événements
          </button>
        </div>
      </div>
    </section>
  );
}

