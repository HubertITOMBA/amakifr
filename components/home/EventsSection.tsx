"use client";

import { Calendar, MapPin, Users, Clock, ArrowRight } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

export function EventsSection() {
  const events = [
    {
      id: 1,
      title: "Conférence sur l'Entrepreneuriat",
      date: "15 Mars 2026",
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
      date: "22 Mars 2026",
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
      date: "5 Avril 2026",
      time: "09h00 - 12h00",
      location: "Centre de Formation AMAKI",
      attendees: 50,
      image: "/images/event3.jpg",
      description: "Un atelier pratique pour développer vos compétences en leadership et communication.",
      status: "Inscription ouverte"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Decorative background elements - opacité réduite */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-blue-300/8 dark:bg-blue-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-300/8 dark:bg-purple-600/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      {/* Top decorative border - plus subtil */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/30 dark:via-blue-600/15 via-purple-400/30 dark:via-purple-600/15 to-transparent opacity-40" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with frame */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative mb-16"
        >
          {/* Decorative corners - couleurs plus douces */}
          <div className="absolute -top-4 -left-4 w-16 h-16 border-t-4 border-l-4 border-blue-400/40 dark:border-blue-600/25 rounded-tl-2xl opacity-50" />
          <div className="absolute -top-4 -right-4 w-16 h-16 border-t-4 border-r-4 border-indigo-400/40 dark:border-indigo-600/25 rounded-tr-2xl opacity-50" />
          
          <div className="relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-8 md:p-12">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-blue-50/20 to-indigo-50/20 dark:from-slate-900/40 dark:via-blue-950/15 dark:to-indigo-950/15 rounded-3xl" />
            <div className="relative z-10 text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                Nos Prochains Événements
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Découvrez notre calendrier d'événements et participez aux activités 
                qui renforcent notre communauté et développent nos compétences.
              </p>
            </div>
          </div>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="relative"
            >
              {/* Gradient border wrapper - plus subtil */}
              <div className="p-1 bg-gradient-to-br from-blue-400/50 via-indigo-500/50 to-purple-500/50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 group">
                <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden h-full">
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
                  <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 transition-all duration-300 flex items-center justify-center group shadow-lg hover:shadow-xl">
                    S'inscrire
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                </div>  15 Ans d'Existence
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Bouton pour voir tous les événements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-12"
        >
          <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 transition-all duration-300 shadow-lg hover:shadow-xl">
            Voir Tous les Événements
          </button>
        </motion.div>
      </div>
      
      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-400/30 dark:via-purple-600/15 via-indigo-400/30 dark:via-indigo-600/15 to-transparent opacity-40" />
    </section>
  );
}

