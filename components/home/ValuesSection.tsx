"use client";

import { Heart, Users, Award, BookOpen, Handshake, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

export function ValuesSection() {
  const values = [
    {
      icon: Heart,
      title: "Solidarité",
      description: "Nous nous soutenons mutuellement dans nos projets personnels et professionnels, créant un réseau d'entraide solide.",
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-900/20"
    },
    {
      icon: Users,
      title: "Intégration",
      description: "Nous facilitons l'intégration de nos membres sur le territoire français .",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Award,
      title: "Respect",
      description: "Nous cultivons un environnement de respect mutuel, d'écoute et de tolérance.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Award,
      title: "Entraide",
      description: "L'entraide est au cœur de notre mission. Nous nous soutenons mutuellement dans les moments difficiles et célébrons ensemble nos succès,créant une véritable famille d'anciens élèves.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Award,
      title: "Excellence",
      description: "Nous promouvons l'excellence académique et professionnelle, encourageant nos membres à toujours viser le meilleur.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Users,
      title: "Communauté",
      description: "Nous créons des liens durables entre les anciens élèves, favorisant les rencontres et les échanges.",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      icon: BookOpen,
      title: "Formation",
      description: "Nous organisons des conférences, ateliers et formations pour le développement continu de nos membres.",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    {
      icon: Handshake,
      title: "Mentorat",
      description: "Les anciens élèves accompagnent les plus jeunes dans leur parcours académique et professionnel.",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "Nous encourageons l'innovation et l'entrepreneuriat parmi nos membres, soutenant leurs projets novateurs.",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-900/20"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 via-purple-50/50 to-indigo-100 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 relative overflow-hidden">
      {/* Decorative background elements - opacité réduite */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-300/8 dark:bg-purple-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-300/8 dark:bg-blue-600/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      {/* Top decorative border - plus subtil */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-400/30 dark:via-purple-600/15 via-blue-400/30 dark:via-blue-600/15 to-transparent opacity-40" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Frame wrapper for header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative mb-16"
        >
          {/* Decorative corners for header - couleurs plus douces */}
          <div className="absolute -top-4 -left-4 w-16 h-16 border-t-4 border-l-4 border-purple-400/40 dark:border-purple-600/25 rounded-tl-2xl opacity-50" />
          <div className="absolute -top-4 -right-4 w-16 h-16 border-t-4 border-r-4 border-blue-400/40 dark:border-blue-600/25 rounded-tr-2xl opacity-50" />
          
          {/* Gradient border wrapper - plus subtil */}
          <div className="p-1 bg-gradient-to-r from-purple-200/40 via-indigo-200/40 to-blue-200/40 dark:from-purple-900/25 dark:via-indigo-900/25 dark:to-blue-900/25 rounded-3xl shadow-xl">
            <div className="relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-8 md:p-12">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-purple-50/20 to-blue-50/20 dark:from-slate-900/40 dark:via-purple-950/15 dark:to-blue-950/15 rounded-3xl" />
              <div className="relative z-10 text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 dark:from-purple-400 dark:via-indigo-400 dark:to-blue-400 bg-clip-text text-transparent">
                  Nos Valeurs Fondamentales
                </h2>
                <h3 className="text-2xl md:text-3xl font-bold text-red-600 dark:text-red-400 mb-4">
                  Intégration, Respect, Solidarité  
                </h3>
                <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                  Ces valeurs guident notre action et définissent l'identité AMAKI. 
                  Elles sont le socle de notre communauté et de notre engagement.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${value.bgColor} p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 group border-2 border-transparent hover:border-white/20 dark:hover:border-slate-700/20`}
            >
              {/* Decorative frame corners */}
              <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-current opacity-20 rounded-tl-lg" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-current opacity-20 rounded-tr-lg" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-current opacity-20 rounded-bl-lg" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-current opacity-20 rounded-br-lg" />
              
              <div className="relative z-10">
              <div className="flex items-center mb-6">
                <div className={`p-3 rounded-xl ${value.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                  <value.icon className={`h-8 w-8 ${value.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">
                  {value.title}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {value.description}
              </p>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Section d'appel à l'action */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 text-center relative"
        >
          {/* Decorative corners - couleurs plus douces */}
          <div className="absolute -top-4 -left-4 w-20 h-20 border-t-4 border-l-4 border-amber-400/40 dark:border-amber-600/25 rounded-tl-3xl opacity-50" />
          <div className="absolute -top-4 -right-4 w-20 h-20 border-t-4 border-r-4 border-orange-400/40 dark:border-orange-600/25 rounded-tr-3xl opacity-50" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 border-b-4 border-l-4 border-yellow-400/40 dark:border-yellow-600/25 rounded-bl-3xl opacity-50" />
          <div className="absolute -bottom-4 -right-4 w-20 h-20 border-b-4 border-r-4 border-orange-400/40 dark:border-orange-600/25 rounded-br-3xl opacity-50" />
          
          {/* Gradient border wrapper - plus subtil */}
          <div className="p-1 bg-gradient-to-r from-amber-200/40 via-orange-200/40 to-yellow-200/40 dark:from-amber-900/25 dark:via-orange-900/25 dark:to-yellow-900/25 rounded-3xl shadow-2xl">
            <div className="relative bg-gradient-to-br from-white via-yellow-50/40 to-orange-50/40 dark:from-slate-800 dark:via-yellow-950/15 dark:to-orange-950/15 rounded-3xl p-8 md:p-12">
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-yellow-50/20 to-orange-50/20 dark:from-slate-800/60 dark:via-yellow-950/10 dark:to-orange-950/10 rounded-3xl" />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Rejoignez Notre Communauté
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                  Découvrez comment ces valeurs se traduisent concrètement dans nos actions 
                  et événements. Participez à notre mission de développement communautaire.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-300 shadow-lg hover:shadow-xl">
                    Devenir Membre
                  </button>
                  <button className="px-8 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-300">
                    Découvrir nos Événements
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/30 dark:via-blue-600/15 via-purple-400/30 dark:via-purple-600/15 to-transparent opacity-40" />
    </section>
  );
}

